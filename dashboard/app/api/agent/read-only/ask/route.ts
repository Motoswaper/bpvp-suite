import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { resolveRepoDocsDir } from "@/lib/docsPaths";
import { SHARED_DOCS_FILE_SET } from "@/lib/sharedDocs";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";

type AskPayload = {
  question?: string;
  lang?: "en" | "es";
  adminOnly?: boolean;
};

type DocHit = {
  file: string;
  score: number;
  excerpt: string;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "como",
  "para",
  "con",
  "una",
  "que",
  "del",
  "los",
  "las",
  "por",
  "sobre"
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s_-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function scoreDoc(questionTokens: string[], text: string): number {
  if (!questionTokens.length) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const token of questionTokens) {
    if (lower.includes(token)) score += 1;
  }
  return score;
}

function buildExcerpt(text: string, token: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const idx = compact.toLowerCase().indexOf(token.toLowerCase());
  if (idx < 0) return compact.slice(0, 260);
  const start = Math.max(0, idx - 90);
  const end = Math.min(compact.length, idx + 170);
  return compact.slice(start, end);
}

function buildAnswer(question: string, lang: "en" | "es", hits: DocHit[]): string {
  if (hits.length === 0) {
    return lang === "es"
      ? `No encontré una respuesta confiable en la base documental para: "${question}". Intenta con más detalle o referencia un módulo.`
      : `I could not find a reliable documentation answer for: "${question}". Try adding more detail or a target module.`;
  }
  const head =
    lang === "es"
      ? "Respuesta basada en documentación BPVP (modo solo lectura):"
      : "Answer based on BPVP documentation (read-only mode):";
  const bullets = hits
    .slice(0, 3)
    .map((h) => `- [${h.file}] ${h.excerpt}`)
    .join("\n");
  const tail =
    lang === "es"
      ? "\n\nSi quieres, puedo convertir esto en pasos operativos por módulo."
      : "\n\nIf you want, I can convert this into module-by-module operational steps.";
  return `${head}\n${bullets}${tail}`;
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 });
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(`agent-readonly:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "auth required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as AskPayload;
  const question = String(body.question ?? "").trim();
  const lang: "en" | "es" = body.lang === "es" ? "es" : "en";
  const wantsAdminCorpus = body.adminOnly === true;
  if (!question) {
    return NextResponse.json({ ok: false, error: "question is required" }, { status: 400 });
  }
  if (wantsAdminCorpus && session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "admin role required" }, { status: 403 });
  }

  const useFullCorpus = session.role === "admin" && wantsAdminCorpus;

  const docsDir = resolveRepoDocsDir();
  const files = (await fs.readdir(docsDir)).filter((f) => f.toLowerCase().endsWith(".md"));
  const tokens = tokenize(question);

  const hits: DocHit[] = [];
  for (const file of files) {
    if (!useFullCorpus) {
      if (!SHARED_DOCS_FILE_SET.has(file)) continue;
    } else if (file === "ADMIN_ONLY_DATA_POLICY_BPVP.md") {
      continue;
    }
    const fullPath = path.join(docsDir, file);
    const content = await fs.readFile(fullPath, "utf8").catch(() => "");
    if (!content) continue;
    const score = scoreDoc(tokens, content);
    if (score <= 0) continue;
    hits.push({
      file,
      score,
      excerpt: buildExcerpt(content, tokens[0] ?? "")
    });
  }

  hits.sort((a, b) => b.score - a.score);
  const answer = buildAnswer(question, lang, hits);

  return NextResponse.json({
    ok: true,
    mode: "read_only",
    scope: useFullCorpus ? "admin_only" : "public_md_only",
    question,
    answer,
    sources: hits.slice(0, 5).map((h) => h.file),
    role: session.role
  });
}
