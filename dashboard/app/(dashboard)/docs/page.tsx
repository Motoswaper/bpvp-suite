import { promises as fs } from "fs";
import path from "path";
import { Navbar } from "@/components/layout/Navbar";
import { resolveRepoDocsDir } from "@/lib/docsPaths";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { AgentReadonlyPanel } from "@/components/docs/AgentReadonlyPanel";
import { getSessionFromServerCookies } from "@/lib/auth";
import { cookies } from "next/headers";

/** Paquete producto (~8): coincide con `lib/sharedDocs.ts` (agente no-admin). */
const docsMapNonAdmin = {
  whitepaper: {
    title: { en: "White paper", es: "Libro blanco" },
    file: "WHITEPAPER_BPVP.md"
  },
  protocol_synopsis: {
    title: { en: "Protocol synopsis", es: "Sinopsis del protocolo" },
    file: "PROTOCOL_SYNOPSIS_BPVP.md"
  },
  decentralization_governance: {
    title: { en: "Decentralization & governance", es: "Descentralizacion y gobernanza" },
    file: "DECENTRALIZATION_GOVERNANCE_BPVP.md"
  },
  conflict_resolution: {
    title: { en: "Conflict resolution", es: "Resolucion de conflictos" },
    file: "CONFLICT_RESOLUTION_BPVP.md"
  },
  module_qa: {
    title: { en: "Module Q&A overview", es: "Q&A por modulo" },
    file: "MODULE_QA_OVERVIEW_BPVP.md"
  },
  utxo_accounting: {
    title: { en: "UTXO & accounting notes", es: "UTXO y contabilidad" },
    file: "UTXO_COLLISIONS_AND_ACCOUNTING_BPVP.md"
  },
  pricing: {
    title: { en: "Pricing (testnet)", es: "Precios (testnet)" },
    file: "PRICING_BPVP.md"
  },
  public_read_only_access: {
    title: { en: "Public API surface", es: "Superficie API publica" },
    file: "PUBLIC_READ_ONLY_ACCESS.md"
  }
} as const;

/** Admin: todo lo anterior + runbooks, auditoria, release, IR, matriz interna. */
const docsMapAdmin = {
  ...docsMapNonAdmin,
  docs_visibility_matrix: {
    title: { en: "Visibility matrix", es: "Matriz de visibilidad" },
    file: "DOCS_VISIBILITY_MATRIX_BPVP.md"
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

type DocMap = typeof docsMapAdmin | typeof docsMapNonAdmin;

const ALL_DOC_TAB_KEYS = new Set(Object.keys(docsMapAdmin));

function resolveDocTab(
  raw: string | undefined,
  docsMap: DocMap
): { key: keyof DocMap; blockedAdminOnly: boolean } {
  const keys = Object.keys(docsMap) as Array<keyof DocMap>;
  const fallback = keys[0];
  if (!raw) return { key: fallback, blockedAdminOnly: false };
  if (Object.prototype.hasOwnProperty.call(docsMap, raw)) {
    return { key: raw as keyof DocMap, blockedAdminOnly: false };
  }
  if (ALL_DOC_TAB_KEYS.has(raw)) {
    return { key: fallback, blockedAdminOnly: true };
  }
  return { key: fallback, blockedAdminOnly: false };
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
  const isAdmin = session?.role === "admin";
  const docsMap: DocMap = isAdmin ? docsMapAdmin : docsMapNonAdmin;
  const { key: docKey, blockedAdminOnly } = resolveDocTab(resolvedSearchParams?.doc, docsMap);
  const selected = docsMap[docKey];
  const docsDir = resolveRepoDocsDir();
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
          isAdmin
            ? locale === "es"
              ? "Como admin ves ademas runbooks, auditoria, incidentes y release."
              : "As admin you also see runbooks, audit, incident response, and release docs."
            : locale === "es"
              ? "Paquete publico: libro blanco, sinopsis, descentralizacion, conflictos, Q&A modulos, UTXO, precios y API publica."
              : "Public pack: white paper, protocol synopsis, decentralization, conflict resolution, module Q&A, UTXO notes, pricing, and public API surface."
        }
        whatToTry={
          locale === "es"
            ? "El agente indexa solo estos 8 markdown para cuentas no admin; admin puede corpus completo."
            : "The agent indexes only these eight markdown files for non-admin accounts; admins can use the full corpus."
        }
        walletHint={
          locale === "es"
            ? "No pegues claves ni .env en el chat del agente."
            : "Do not paste keys or .env into the agent chat."
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
                  ? "border-bpvp-border-strong bg-bpvp-hover text-bpvp-ink"
                  : "border-bpvp-border bg-bpvp-input text-bpvp-muted hover:bg-bpvp-hover hover:text-bpvp-ink"
              }`}
            >
              {meta.title[locale]}
            </a>
          );
        })}
      </div>

      {blockedAdminOnly ? (
        <p className="rounded-md border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          {locale === "es"
            ? "Ese documento solo esta disponible para administradores. Mostramos la primera pestaña publica."
            : "That document is only available to administrators. Showing the first public tab instead."}
        </p>
      ) : null}

      <article className="rounded-lg border border-bpvp-border bg-bpvp-card p-4">
        <h2 className="mb-3 text-lg font-semibold text-bpvp-ink">{selected.title[locale]}</h2>
        <pre className="overflow-auto whitespace-pre-wrap text-sm leading-6 text-bpvp-ink">
          {content}
        </pre>
      </article>
      <AgentReadonlyPanel locale={locale} audience={isAdmin ? "admin-only" : "public-auth"} />
    </section>
  );
}
