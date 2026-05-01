"use client";

import { useMemo } from "react";
import { useLocale } from "@/lib/useLocale";

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
  const { isSpanish } = useLocale();

  const renderedTitle = useMemo(() => {
    if (!isSpanish) return title;
    return ES_TITLE_MAP[title] ?? title;
  }, [isSpanish, title]);
  const subtitle = isSpanish ? "Infraestructura Bitcoin L1" : "Bitcoin L1 Infrastructure";

  return (
    <header className="mb-6 space-y-3">
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
