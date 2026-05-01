type Locale = "en" | "es";

const FOOTER_COPY: Record<
  Locale,
  {
    title: string;
    risk: string;
    compliance: string;
    security: string;
    ops: string;
    legal: string;
    contact: string;
    disclaimer: string;
    signature: string;
  }
> = {
  en: {
    title: "Institutional Operations Footer",
    risk: "Risk controls active: role-based access, step-up for sensitive admin actions.",
    compliance: "Compliance posture: audit logging, DID verification controls, and traceable operational flows.",
    security: "Security baseline: rate limits, origin policies, secret isolation, and hardened headers.",
    ops: "Operational status: monitored services with readiness gates and incident runbooks.",
    legal: "Legal notice: testnet environment. No production custody, no investment solicitation.",
    contact: "Institutional contact: ops@btc-defi.com | security@btc-defi.com",
    disclaimer: "All metrics and workflows are for controlled validation unless explicitly designated for production.",
    signature: "Design and development by Zepol Trebuoj"
  },
  es: {
    title: "Pie Institucional de Operaciones",
    risk: "Controles de riesgo activos: acceso por rol y step-up para acciones admin sensibles.",
    compliance: "Postura de cumplimiento: auditoria de eventos, controles DID y flujos trazables.",
    security: "Baseline de seguridad: rate limits, politicas de origen, aislamiento de secretos y headers reforzados.",
    ops: "Estado operativo: servicios monitoreados con gates de readiness y runbooks de incidente.",
    legal: "Aviso legal: entorno testnet. Sin custodia productiva ni oferta de inversion.",
    contact: "Contacto institucional: ops@btc-defi.com | security@btc-defi.com",
    disclaimer: "Todas las metricas y flujos son para validacion controlada salvo designacion expresa de produccion.",
    signature: "Diseño y desarrollo por Zepol Trebuoj"
  }
};

export function GlobalFooter({ locale }: { locale: Locale }) {
  const t = FOOTER_COPY[locale];
  return (
    <footer className="mx-auto mt-6 w-full max-w-6xl rounded-xl border border-slate-800 bg-[#101523] p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{t.title}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <p className="text-xs text-slate-300">{t.risk}</p>
        <p className="text-xs text-slate-300">{t.compliance}</p>
        <p className="text-xs text-slate-300">{t.security}</p>
        <p className="text-xs text-slate-300">{t.ops}</p>
        <p className="text-xs text-slate-400">{t.legal}</p>
        <p className="text-xs text-slate-400">{t.contact}</p>
      </div>
      <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">{t.disclaimer}</p>
      <p className="mt-2 text-[11px] font-medium text-slate-400">{t.signature}</p>
    </footer>
  );
}
