import { cookies, headers } from "next/headers";
import { TestnetGuestAccess } from "@/components/auth/TestnetGuestAccess";
import { getSessionFromServerCookies } from "@/lib/auth";

type Locale = "en" | "es";

type Copy = {
  badge: string;
  brandName: string;
  brandTagline: string;
  title: string;
  bannerAlt: string;
  panelTitle: string;
  chartBtc: string;
  chartBpvp: string;
  chartTrend: string;
  chartVolume: string;
  tickerSync: string;
  tickerQuality: string;
  modulesTitle: string;
  modulesLockedHint: string;
  footerTitle: string;
  footerRisk: string;
  footerCompliance: string;
  footerSecurity: string;
  footerLegal: string;
  footerOps: string;
  footerContact: string;
  footerDisclaimer: string;
  intro: string;
  definitionA: string;
  definitionB: string;
  step1Title: string;
  step1Body: string;
  step2Title: string;
  step2Body: string;
  step3Title: string;
  step3Body: string;
  openLogin: string;
  enterGuest: string;
  creatingGuest: string;
  downloadWallet: string;
  guestError: string;
  status: string;
};

const COPY: Record<Locale, Copy> = {
  en: {
    badge: "BPVP Testnet Access",
    brandName: "BPVP Suite",
    brandTagline: "Bitcoin-Native DeFi Operating Layer",
    title: "BPVP: Bitcoin-Native DeFi Operating Layer",
    bannerAlt: "Modular infrastructure for decentralized finance on Bitcoin",
    panelTitle: "Market Signal Snapshot",
    chartBtc: "Bitcoin Price",
    chartBpvp: "BPVP Price",
    chartTrend: "Trend",
    chartVolume: "Volume",
    tickerSync: "Sync",
    tickerQuality: "Quality",
    modulesTitle: "BPVP Modules",
    modulesLockedHint: "Sign in or enter as test guest to unlock",
    footerTitle: "Institutional Operations Footer",
    footerRisk: "Risk controls active: role-based access, step-up for sensitive admin actions.",
    footerCompliance: "Compliance posture: audit logging, DID verification controls, and traceable operational flows.",
    footerSecurity: "Security baseline: rate limits, origin policies, secret isolation, and hardened headers.",
    footerLegal: "Legal notice: testnet environment. No production custody, no investment solicitation.",
    footerOps: "Operational status: monitored services with readiness gates and incident runbooks.",
    footerContact: "Institutional contact: ops@btc-defi.com | security@btc-defi.com",
    footerDisclaimer: "All metrics and workflows are for controlled validation unless explicitly designated for production.",
    intro:
      "Welcome to BPVP. This is a live testnet entrance where teams can experience, validate, and demonstrate institutional Bitcoin DeFi workflows in one unified system.",
    definitionA:
      "BPVP is a Bitcoin-native DeFi system layer focused on coordinated state, market operations, settlement, and risk workflows around BTC assets. In practical terms, BPVP seeks to make BTC DeFi operable with institutional-grade controls: observable modules, deterministic actions, and verifiable execution paths across token, market, trust, lending, and settlement flows.",
    definitionB:
      "What makes BPVP special is the combination of security, observability, and deterministic execution: every critical flow can be monitored, tested, and audited before production scale.",
    step1Title: "1) Existing user sign in",
    step1Body: "Open login for users who already have username/password.",
    step2Title: "2) Explore modules",
    step2Body: "Review market, OTC, quant, and operational views.",
    step3Title: "3) Report findings",
    step3Body: "Share any errors, regressions, or UX issues with your team contact.",
    openLogin: "Open Existing User Login",
    enterGuest: "Enter as Test Guest",
    creatingGuest: "Creating guest access...",
    downloadWallet: "Download BPVP Wallet",
    guestError: "Failed to create guest access",
    status: "Status: running on live testnet preview infrastructure."
  },
  es: {
    badge: "Acceso Testnet BPVP",
    brandName: "BPVP Suite",
    brandTagline: "Capa Operativa DeFi Nativa de Bitcoin",
    title: "BPVP: Capa Operativa DeFi Nativa de Bitcoin",
    bannerAlt: "Infraestructura modular para finanzas descentralizadas sobre Bitcoin",
    panelTitle: "Panel de Senales de Mercado",
    chartBtc: "Precio Bitcoin",
    chartBpvp: "Precio BPVP",
    chartTrend: "Tendencia",
    chartVolume: "Volumen",
    tickerSync: "Sync",
    tickerQuality: "Calidad",
    modulesTitle: "Modulos BPVP",
    modulesLockedHint: "Inicia sesion o entra como invitado para desbloquear",
    footerTitle: "Pie Institucional de Operaciones",
    footerRisk: "Controles de riesgo activos: acceso por rol y step-up para acciones admin sensibles.",
    footerCompliance: "Postura de cumplimiento: auditoria de eventos, controles DID y flujos trazables.",
    footerSecurity: "Baseline de seguridad: rate limits, politicas de origen, aislamiento de secretos y headers reforzados.",
    footerLegal: "Aviso legal: entorno testnet. Sin custodia productiva ni oferta de inversion.",
    footerOps: "Estado operativo: servicios monitoreados con gates de readiness y runbooks de incidente.",
    footerContact: "Contacto institucional: ops@btc-defi.com | security@btc-defi.com",
    footerDisclaimer: "Todas las metricas y flujos son para validacion controlada salvo designacion expresa de produccion.",
    intro:
      "Bienvenido a BPVP. Esta es una entrada activa de testnet para que equipos puedan experimentar, validar y demostrar flujos institucionales de DeFi sobre Bitcoin en un solo sistema unificado.",
    definitionA:
      "BPVP es una capa de sistema DeFi nativa de Bitcoin, enfocada en estado coordinado, operacion de mercado, liquidacion y flujos de riesgo sobre activos BTC. En la practica, BPVP busca hacer operable el DeFi sobre Bitcoin con controles de nivel institucional: modulos observables, acciones deterministicas y rutas de ejecucion verificables en token, mercado, trust, lending y settlement.",
    definitionB:
      "Lo especial de BPVP es la combinacion de seguridad, observabilidad y ejecucion deterministica: cada flujo critico puede monitorearse, probarse y auditarse antes de escalar a produccion.",
    step1Title: "1) Inicio de sesion usuario existente",
    step1Body: "Abre el login para usuarios que ya tienen usuario y password.",
    step2Title: "2) Explora los modulos",
    step2Body: "Revisa vistas de mercado, OTC, cuantitativos y operacion.",
    step3Title: "3) Reporta hallazgos",
    step3Body: "Comparte errores, regresiones o problemas de UX con tu contacto del equipo.",
    openLogin: "Abrir Login Usuario Existente",
    enterGuest: "Entrar como Invitado de Prueba",
    creatingGuest: "Creando acceso invitado...",
    downloadWallet: "Descargar BPVP Wallet",
    guestError: "No se pudo crear el acceso invitado",
    status: "Estado: ejecutandose sobre infraestructura activa de vista previa testnet."
  }
};

function inferLocale(acceptLanguage: string | null, country: string | null): Locale {
  const lang = (acceptLanguage || "").toLowerCase();
  if (lang.startsWith("es") || lang.includes(",es") || lang.includes(";q=es")) return "es";

  const countryCode = (country || "").toUpperCase();
  const spanishCountries = new Set([
    "AR",
    "BO",
    "CL",
    "CO",
    "CR",
    "CU",
    "DO",
    "EC",
    "ES",
    "GQ",
    "GT",
    "HN",
    "MX",
    "NI",
    "PA",
    "PE",
    "PR",
    "PY",
    "SV",
    "UY",
    "VE"
  ]);
  if (spanishCountries.has(countryCode)) return "es";
  return "en";
}

export default async function HomePage({ searchParams }: { searchParams?: { lang?: string } }) {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const session = await getSessionFromServerCookies();
  const urlLang = String(searchParams?.lang ?? "").toLowerCase();
  const forcedLocale: Locale | null = urlLang === "es" || urlLang === "en" ? (urlLang as Locale) : null;
  const cookieLocaleRaw = String(cookieStore.get("bpvp_locale")?.value ?? "").toLowerCase();
  const cookieLocale: Locale | null = cookieLocaleRaw === "es" || cookieLocaleRaw === "en" ? (cookieLocaleRaw as Locale) : null;
  const locale = forcedLocale ?? cookieLocale ?? inferLocale(reqHeaders.get("accept-language"), reqHeaders.get("cf-ipcountry"));
  const isSpanish = locale === "es";
  const t = COPY[locale];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BPVP Suite",
    url: "https://testnet.btc-defi.com",
    description:
      "Bitcoin-native DeFi operating layer for BTC, BTC-Fi, market workflows, lending, trust, and settlement.",
    sameAs: ["https://bitcoin.org"],
    keywords: "Bitcoin,BTC,DeFi,BTC-Fi,Bitcoin DeFi,BPVP"
  };

  return (
    <main className="min-h-screen bg-[#0b0f18] text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-12">
        <section className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#101523] shadow-sm">
          <img
            src="/brand/hero-banner.png"
            alt={t.bannerAlt}
            className="h-28 w-full object-cover sm:h-32 md:h-36 lg:h-40"
            loading="eager"
          />
        </section>
        <div className="flex justify-end">
          <a
            href={`/profile?lang=${locale}`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-600 hover:bg-slate-900"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-cyan-300">
              <path
                fill="currentColor"
                d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
              />
            </svg>
            <span>{isSpanish ? "Perfil (entrada de wallet)" : "Profile (wallet entry)"}</span>
          </a>
        </div>
        <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="rounded-xl border border-slate-800 bg-[#101523] p-4 shadow-sm">
            <div className="grid items-start gap-4 sm:grid-cols-[auto_1fr]">
              <img
                src="/brand/bpvp-suite-logo-final.png"
                alt={`${t.brandName} logo`}
                className="h-auto w-full max-w-[170px] rounded-md border border-slate-700 bg-slate-950/50 p-1"
              />
              <div className="space-y-3">
                <div className="inline-flex items-center rounded-full border border-[#1FA2FF]/45 bg-[#1FA2FF]/12 px-3 py-1 text-xs font-medium text-[#7fd6ff]">
                  {t.badge}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
                <p className="mt-2 text-sm text-slate-300">{t.intro}</p>
                <p className="text-xs text-slate-300 sm:text-sm">{t.definitionA}</p>
                <p className="text-xs text-slate-400 sm:text-sm">{t.definitionB}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#101523] p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-100">
              {t.modulesTitle} <span className="font-normal text-slate-400">({t.status})</span>
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { name: "Marketplace", path: "/marketplace", desc: isSpanish ? "Listados, trades y flujo externo." : "Listings, trades, and external flow." },
                { name: "DID", path: "/did", desc: isSpanish ? "Identidad descentralizada y verificables." : "Decentralized identity and verifiables." },
                { name: "Quant", path: "/", desc: isSpanish ? "KPIs, alertas y reportes cuantitativos." : "KPIs, alerts, and quantitative reports." },
                { name: "Market", path: "/market", desc: isSpanish ? "Trading spot y estado de mercado." : "Spot trading and market state." },
                { name: "OTC", path: "/otc", desc: isSpanish ? "Operaciones over-the-counter y desk flow." : "Over-the-counter operations and desk flow." },
                { name: "Lending", path: "/lend", desc: isSpanish ? "Flujos de prestamo y gestion de riesgo." : "Lending flows and risk controls." },
                { name: "Trust", path: "/trust", desc: isSpanish ? "Reglas de confianza y custodia operativa." : "Trust rules and operational custody." },
                { name: "Ops", path: "/ops", desc: isSpanish ? "Control operativo, seguridad y automacion." : "Operational control, security, automation." },
                { name: "BPVP20", path: "/bpvp20", desc: isSpanish ? "Activos tokenizados y utilidades BPVP20." : "Tokenized assets and BPVP20 utilities." },
                { name: "BPVP721", path: "/bpvp721", desc: isSpanish ? "Identidad/NFT y objetos unicos." : "Identity/NFT and unique digital objects." },
                { name: "Bridge", path: "/bridge", desc: isSpanish ? "Canales de interoperabilidad operativa." : "Operational interoperability channels." },
                { name: "Docs", path: "/docs", desc: isSpanish ? "Documentacion tecnica y runbooks." : "Technical documentation and runbooks." }
              ].map((m) => (
                session ? (
                  <a key={m.name} href={m.path} className="group relative rounded-md border border-slate-700 bg-slate-900/70 px-2 py-2 text-[11px] text-slate-200 hover:border-slate-600 hover:bg-slate-900">
                    <p className="font-semibold">{m.name}</p>
                    <div className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden w-52 -translate-x-1/2 -translate-y-full rounded-md border border-slate-700 bg-black/95 p-2 text-[11px] text-slate-200 shadow-xl group-hover:block">
                      {m.desc}
                    </div>
                  </a>
                ) : (
                  <div key={m.name} className="group relative rounded-md border border-slate-700 bg-slate-900/70 px-2 py-2 text-[11px] text-slate-200 opacity-80">
                    <p className="font-semibold">{m.name}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{t.modulesLockedHint}</p>
                    <div className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden w-52 -translate-x-1/2 -translate-y-full rounded-md border border-slate-700 bg-black/95 p-2 text-[11px] text-slate-200 shadow-xl group-hover:block">
                      {m.desc}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-slate-800 bg-[#101523] p-5 sm:grid-cols-3">
          <article className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-100">{t.step1Title}</h2>
            <p className="text-xs text-slate-400">{t.step1Body}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={`/login-basic?lang=${locale}`}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
              >
                {t.openLogin}
              </a>
              <a
                href={`/wallet?lang=${locale}`}
                className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
              >
                {t.downloadWallet}
              </a>
            </div>
          </article>
          <article className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-100">{t.step2Title}</h2>
            <p className="text-xs text-slate-400">{t.step2Body}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <TestnetGuestAccess idleLabel={t.enterGuest} busyLabel={t.creatingGuest} />
            </div>
          </article>
          <article className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-100">{t.step3Title}</h2>
            <p className="text-xs text-slate-400">{t.step3Body}</p>
          </article>
        </section>

      </section>
    </main>
  );
}
