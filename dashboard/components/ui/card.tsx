"use client";

import { ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/useLocale";

const ES_CARD_TITLE_MAP: Record<string, string> = {
  "AMM Desk (Institutional Preview)": "Mesa AMM (Vista Institucional)",
  "Data Exports": "Exportacion de Datos",
  "24h Quant Report": "Reporte Cuantitativo 24h",
  "Canonical KPI Trend (Lag vs Quality)": "Tendencia KPI Canonico (Lag vs Calidad)",
  "Open RFQs": "RFQs Abiertos",
  "Open trades": "Trades Abiertos",
  "Quotes total": "Total de Cotizaciones",
  "Trades total": "Total de Trades",
  "Create RFQ": "Crear RFQ",
  "Submit quote": "Enviar Cotizacion",
  "Accept quote (create trade)": "Aceptar Cotizacion (crear trade)",
  "Settle trade": "Liquidar trade",
  RFQs: "RFQs",
  Quotes: "Cotizaciones",
  Trades: "Trades",
  "History tail": "Historial Reciente",
  "Enqueue Bridge Jobs (admin)": "Encolar Jobs de Bridge (admin)",
  "Bridge Policy (Admin)": "Politica de Bridge (Admin)",
  "Bridge Job Lifecycle (admin)": "Ciclo de Vida de Job de Bridge (admin)",
  "Bridge Queue": "Cola de Bridge",
  Assets: "Activos",
  Mint: "Mint",
  Transfer: "Transferencia",
  Metadata: "Metadatos",
  Scores: "Puntajes",
  "Record score update": "Registrar Actualizacion de Puntaje",
  Pools: "Pools",
  "Open positions": "Posiciones Abiertas",
  "Simulate borrow (engine action)": "Simular Prestamo (accion de engine)",
  "Settlement records": "Registros de Liquidacion",
  "Record payment settled": "Registrar Pago Liquidado",
  "Record liquidation settled": "Registrar Liquidacion Confirmada",
  Session: "Sesion",
  Documentation: "Documentacion"
};

export function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const { isSpanish } = useLocale();

  const renderedTitle = useMemo(() => {
    if (!isSpanish) return title;
    return ES_CARD_TITLE_MAP[title] ?? title;
  }, [isSpanish, title]);

  return (
    <section className={cn("rounded-xl border border-slate-800 bg-[#101523] p-4", className)}>
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{renderedTitle}</h3>
      {children}
    </section>
  );
}
