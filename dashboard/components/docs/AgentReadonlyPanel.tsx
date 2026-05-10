"use client";

import { FormEvent, useState } from "react";

type Locale = "en" | "es";

type AskResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
  sources?: string[];
};

type Audience = "public-auth" | "admin-only";

export function AgentReadonlyPanel({
  locale,
  audience = "public-auth"
}: {
  locale: Locale;
  audience?: Audience;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);
    try {
      const res = await fetch("/api/agent/read-only/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          lang: locale,
          adminOnly: audience === "admin-only"
        })
      });
      const data = (await res.json().catch(() => ({}))) as AskResponse;
      if (!res.ok || !data.ok) {
        setError(data.error || (locale === "es" ? "Error consultando el agente." : "Error querying agent."));
        return;
      }
      setAnswer(String(data.answer || ""));
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch {
      setError(locale === "es" ? "Fallo de red al consultar el agente." : "Network error while querying agent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-bpvp-border bg-bpvp-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-bpvp-ink">
        {locale === "es" ? "Agente BPVP (solo lectura)" : "BPVP Agent (read-only)"}
      </h3>
      <p className="mb-2 text-[11px] font-medium text-cyan-300">
        {audience === "admin-only"
          ? locale === "es"
            ? "Alcance: solo admin"
            : "Scope: admin only"
          : locale === "es"
            ? "Alcance: publico autenticado (requiere sesion)"
            : "Scope: authenticated public (session required)"}
      </p>
      <p className="mb-3 text-xs text-bpvp-muted">
        {locale === "es"
          ? "Consulta operacion por modulo y documentacion sin ejecutar acciones mutables."
          : "Ask module operation and documentation questions without executing mutating actions."}
      </p>
      <form onSubmit={onAsk} className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            locale === "es"
              ? "Ejemplo: Como funciona DID verify y que rol necesita?"
              : "Example: How does DID verify work and what role is required?"
          }
          className="min-h-[86px] w-full rounded-md border border-bpvp-input-border bg-bpvp-input px-3 py-2 text-sm text-bpvp-ink"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? locale === "es"
                ? "Consultando..."
                : "Asking..."
              : locale === "es"
                ? "Consultar"
                : "Ask"}
          </button>
        </div>
      </form>
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      {answer ? (
        <div className="mt-3 space-y-2 rounded-md border border-bpvp-border bg-bpvp-code-bg p-3">
          <pre className="whitespace-pre-wrap text-xs leading-5 text-bpvp-ink">{answer}</pre>
          {sources.length > 0 ? (
            <p className="text-[11px] text-bpvp-muted">
              {locale === "es" ? "Fuentes: " : "Sources: "}
              {sources.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
