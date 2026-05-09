import { promises as fs } from "fs";
import path from "path";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { AgentReadonlyPanel } from "@/components/docs/AgentReadonlyPanel";
import { getSessionFromServerCookies } from "@/lib/auth";
import { cookies } from "next/headers";

/** Keys match files under repo root `docs/` (see dashboard path.join below). */
const docsMapAdmin = {
  public_read_only_access: {
    title: { en: "Public read-only access", es: "Acceso publico de solo lectura" },
    file: "PUBLIC_READ_ONLY_ACCESS.md"
  },
  canonical_workspace: {
    title: { en: "Canonical workspace", es: "Workspace canonico" },
    file: "CANONICAL_WORKSPACE.md"
  },
  operations: {
    title: { en: "Operations runbook", es: "Runbook operativo" },
    file: "operations.md"
  },
  audit_security_policy: {
    title: { en: "Audit & security policy", es: "Politica de auditoria y seguridad" },
    file: "AUDIT_SECURITY_POLICY.md"
  },
  audit_coverage_matrix: {
    title: { en: "Audit coverage matrix", es: "Matriz de cobertura de auditoria" },
    file: "AUDIT_COVERAGE_MATRIX.md"
  },
  security_incident_response: {
    title: { en: "Security incident response", es: "Respuesta a incidentes de seguridad" },
    file: "SECURITY_INCIDENT_RESPONSE_POLICY.md"
  },
  security_incident_template: {
    title: { en: "Security incident template", es: "Plantilla de incidente de seguridad" },
    file: "SECURITY_INCIDENT_TEMPLATE.md"
  },
  wallet_release_process: {
    title: { en: "BPVP Wallet release process", es: "Proceso de release BPVP Wallet" },
    file: "BPVP_WALLET_RELEASE_PROCESS.md"
  },
  wallet_signet: {
    title: { en: "Wallet Signet implementation", es: "Implementacion Wallet Signet" },
    file: "BPVP_WALLET_SIGNET_IMPLEMENTATION.md"
  },
  release_notes_rc1: {
    title: { en: "Release notes (RC1)", es: "Notas de release (RC1)" },
    file: "release-notes-rc1.md"
  },
  release_checklist: {
    title: { en: "Release checklist", es: "Checklist de release" },
    file: "release-checklist.md"
  }
} as const;

const docsMapViewer = {
  public_read_only_access: {
    title: { en: "Public read-only access", es: "Acceso publico de solo lectura" },
    file: "PUBLIC_READ_ONLY_ACCESS.md"
  },
  canonical_workspace: {
    title: { en: "Canonical workspace", es: "Workspace canonico" },
    file: "CANONICAL_WORKSPACE.md"
  },
  operations: {
    title: { en: "Operations runbook", es: "Runbook operativo" },
    file: "operations.md"
  },
  release_checklist: {
    title: { en: "Release checklist", es: "Checklist de release" },
    file: "release-checklist.md"
  }
} as const;

type DocMap = typeof docsMapAdmin | typeof docsMapViewer;

function getDocKey(raw: string | undefined, docsMap: DocMap): keyof DocMap {
  const keys = Object.keys(docsMap) as Array<keyof DocMap>;
  const fallback = keys[0];
  if (!raw) return fallback;
  if (Object.prototype.hasOwnProperty.call(docsMap, raw)) {
    return raw as keyof DocMap;
  }
  return fallback;
}

export default async function DocsPage({
  searchParams
}: {
  searchParams?: { doc?: string; lang?: string } | Promise<{ doc?: string; lang?: string }>;
}) {
  const resolvedSearchParams =
    searchParams && typeof searchParams === "object" && "then" in searchParams
      ? await searchParams
      : searchParams;
  const session = await getSessionFromServerCookies();
  const cookieStore = await cookies();
  const locale = String(cookieStore.get("bpvp_locale")?.value ?? "").toLowerCase() === "es" ? "es" : "en";
  const docsMap: DocMap = session?.role === "admin" ? docsMapAdmin : docsMapViewer;
  const docKey = getDocKey(resolvedSearchParams?.doc, docsMap);
  const selected = docsMap[docKey];
  const docsDir = path.resolve(process.cwd(), "..", "docs");
  const docPath = path.join(docsDir, selected.file);
  let content = "";
  try {
    content = await fs.readFile(docPath, "utf8");
  } catch {
    content =
      locale === "es"
        ? "Documento no disponible temporalmente. Verifica que el archivo exista en /docs."
        : "Document temporarily unavailable. Verify the file exists under /docs.";
  }

  if (locale === "es") {
    const ext = path.extname(selected.file);
    const base = selected.file.slice(0, selected.file.length - ext.length);
    const spanishPath = path.join(docsDir, `${base}_ES${ext}`);
    try {
      content = await fs.readFile(spanishPath, "utf8");
    } catch {
      // Fallback to canonical English file when no Spanish translation exists yet.
    }
  }

  return (
    <section className="space-y-4">
      <Navbar title={locale === "es" ? "Documentacion" : "Documentation"} />
      <ModuleGuide
        whatThisDoes={
          locale === "es"
            ? "Este modulo ofrece explicaciones del sistema y documentacion de pruebas para usuarios."
            : "This module provides public system explanations and testing documentation."
        }
        whatToTry={
          locale === "es"
            ? "Empieza por Acceso publico / Workspace canonico u Operaciones; los documentos de auditoria y seguridad estan disponibles para admins."
            : "Start with Public read-only access, Canonical workspace, or Operations; audit and security packs are available to admins."
        }
        walletHint={
          locale === "es"
            ? "Los detalles de vinculacion de wallet estan documentados en Profile y endpoints de auth, no en este visor de docs."
            : "Wallet link details are documented in Profile and auth endpoints, not in this docs viewer."
        }
      />

      <div className="flex flex-wrap gap-2">
        {(Object.entries(docsMap) as Array<[keyof DocMap, DocMap[keyof DocMap]]>).map(([key, meta]) => {
          const isActive = key === docKey;
          const href = `/docs?doc=${key}&lang=${locale}`;
          return (
            <a
              key={key}
              href={href}
              className={`rounded-md border px-3 py-2 text-sm ${
                isActive
                  ? "border-blue-500 bg-blue-900/40 text-blue-100"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {meta.title[locale]}
            </a>
          );
        })}
      </div>

      <article className="rounded-lg border border-slate-800 bg-black p-4">
        <h2 className="mb-3 text-lg font-semibold">{selected.title[locale]}</h2>
        <pre className="overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-200">
          {content}
        </pre>
      </article>
      <AgentReadonlyPanel locale={locale} audience="public-auth" />
    </section>
  );
}
