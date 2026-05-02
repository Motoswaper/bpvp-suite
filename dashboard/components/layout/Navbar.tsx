"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/useLocale";
import { usePathname } from "next/navigation";

const ES_TITLE_MAP: Record<string, string> = {
  Overview: "Resumen",
  Market: "Mercado",
  Marketplace: "Marketplace",
  DID: "DID",
  OTC: "OTC",
  "Bridge Controller": "Control de Bridge",
  BPVP20: "BPVP20",
  BPVP721: "BPVP721",
  Trust: "Confianza",
  Lend: "Prestamos",
  Settle: "Liquidacion",
  Profile: "Perfil",
  Documentation: "Documentacion",
  "Ops Admin": "Admin Ops"
};

export function Navbar({ title }: { title: string }) {
  const { isSpanish, locale } = useLocale();
  const pathname = usePathname();

  const renderedTitle = useMemo(() => {
    if (!isSpanish) return title;
    return ES_TITLE_MAP[title] ?? title;
  }, [isSpanish, title]);
  const subtitle = isSpanish ? "Infraestructura Bitcoin L1" : "Bitcoin L1 Infrastructure";
  const onProfilePage = pathname === "/profile";
  const quickHref = onProfilePage ? `/?lang=${locale}` : `/profile?lang=${locale}`;
  const quickLabel = onProfilePage
    ? isSpanish
      ? "Inicio"
      : "Home"
    : isSpanish
      ? "Perfil (wallet)"
      : "Profile (wallet)";

  return (
    <header className="mb-6 space-y-3">
      <div className="flex justify-end">
        <a
          href={quickHref}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-600 hover:bg-slate-900"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-cyan-300">
            <path
              fill="currentColor"
              d={
                onProfilePage
                  ? "m12 3 9 8h-3v9h-5v-6h-2v6H6v-9H3z"
                  : "M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
              }
            />
          </svg>
          <span>{quickLabel}</span>
        </a>
      </div>
      <section className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#101523]">
        <img
          src="/brand/hero-banner.png"
          alt={isSpanish ? "Banner del modulo" : "Module banner"}
          className="h-20 w-full object-cover sm:h-24"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex items-end justify-between px-4 py-3">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">{renderedTitle}</h2>
          <p className="text-xs text-slate-200">{subtitle}</p>
        </div>
      </section>
    </header>
  );
}
