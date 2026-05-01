import { promises as fs } from "fs";
import path from "path";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { AgentReadonlyPanel } from "@/components/docs/AgentReadonlyPanel";
import { getSessionFromServerCookies } from "@/lib/auth";
import { cookies } from "next/headers";

const docsMapAdmin = {
  system_synopsis: {
    title: { en: "System Synopsis", es: "Sinopsis del Sistema" },
    file: "SYSTEM_SYNOPSIS_BPVP.md"
  },
  "protocol-spec-v1": {
    title: { en: "Protocol Spec v1", es: "Especificacion de Protocolo v1" },
    file: "protocol-spec-v1.md"
  },
  module_qa_session: {
    title: { en: "Module Q&A Session", es: "Sesion Q&A De Modulos" },
    file: "MODULE_QA_SESSION_BPVP.md"
  },
  tokenomics_bpvp: {
    title: { en: "Tokenomics BPVP", es: "Tokenomics BPVP" },
    file: "TOKENOMICS_BPVP.md"
  },
  fee_policy_public: {
    title: { en: "Fee Policy", es: "Politica de Fees" },
    file: "FEE_POLICY_CLIENT_BPVP.md"
  },
  pricing_bpvp: {
    title: { en: "Pricing", es: "Precios" },
    file: "PRICING_BPVP.md"
  },
  operations: {
    title: { en: "Operations Runbook", es: "Runbook Operativo" },
    file: "operations.md"
  },
  possible_business_model: {
    title: { en: "Possible Business Model", es: "Posible Modelo de Negocio" },
    file: "POSSIBLE_BUSINESS_MODEL.md"
  },
  mainnet_launch_checklist: {
    title: { en: "Mainnet Launch Checklist", es: "Checklist Lanzamiento Mainnet" },
    file: "MAINNET_LAUNCH_CHECKLIST.md"
  },
  prod_ready: {
    title: { en: "Prod Ready", es: "Listo para Produccion" },
    file: "PROD_READY.md"
  },
  release_checklist: {
    title: { en: "Release Checklist", es: "Checklist de Release" },
    file: "release-checklist.md"
  }
} as const;

const docsMapViewer = {
  system_synopsis: {
    title: { en: "System Synopsis", es: "Sinopsis del Sistema" },
    file: "SYSTEM_SYNOPSIS_BPVP.md"
  },
  "protocol-spec-v1": {
    title: { en: "Protocol Spec v1", es: "Especificacion de Protocolo v1" },
    file: "protocol-spec-v1.md"
  },
  module_qa_session: {
    title: { en: "Module Q&A Session", es: "Sesion Q&A De Modulos" },
    file: "MODULE_QA_SESSION_BPVP.md"
  },
  tokenomics_bpvp: {
    title: { en: "Tokenomics BPVP", es: "Tokenomics BPVP" },
    file: "TOKENOMICS_BPVP.md"
  },
  fee_policy_public: {
    title: { en: "Fee Policy", es: "Politica de Fees" },
    file: "FEE_POLICY_CLIENT_BPVP.md"
  },
  pricing_bpvp: {
    title: { en: "Pricing", es: "Precios" },
    file: "PRICING_BPVP.md"
  }
} as const;

type DocMap = typeof docsMapAdmin | typeof docsMapViewer;

function getDocKey(raw: string | undefined, docsMap: DocMap): keyof DocMap {
  if (!raw) return "system_synopsis";
  if (Object.prototype.hasOwnProperty.call(docsMap, raw)) {
    return raw as keyof DocMap;
  }
  return "system_synopsis";
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
            ? "Empieza por Sinopsis del Sistema, luego revisa el Protocolo y ejecuta checks relacionados en los modulos del producto."
            : "Start with System Synopsis, then review Protocol Spec and execute related checks in product modules."
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
