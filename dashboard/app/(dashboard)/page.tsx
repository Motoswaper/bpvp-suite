"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { KpiCard } from "@/components/cards/KpiCard";
import { Card } from "@/components/ui/card";
import { KpiTrendChart } from "@/components/charts/KpiTrendChart";
import { EngineStatusCard } from "@/components/cards/EngineStatusCard";
import { useLocale } from "@/lib/useLocale";

type CanonicalSnapshot = {
  ts: number;
  engineHeight: number;
  indexerHeight: number;
  targetHeight: number;
  watcherHeight: number;
  syncLag: number;
  syncPercent: number;
  marketTrades: number;
  orderbookNotional: number;
  actionsPushed: number;
  servicesHealthy: boolean;
  integrity: {
    monotonicIndexerHeight: boolean;
    watcherNotAheadIndexer: boolean;
    targetNotBelowIndexer: boolean;
  };
  qualityScore: number;
  velocityBlocksPerMin: number;
  etaToTipMinutes: number | null;
  alertStatus: "GREEN" | "AMBER" | "RED";
};

type AlertWindowSummary = {
  points: number;
  counts: { GREEN: number; AMBER: number; RED: number };
  redRatio: number;
  latest: {
    ts: number;
    alertStatus: "GREEN" | "AMBER" | "RED";
    qualityScore: number;
    syncLag: number;
    velocityBlocksPerMin: number;
  } | null;
};

type AlertPayload = {
  windows: {
    m15: AlertWindowSummary;
    h1: AlertWindowSummary;
    h6: AlertWindowSummary;
    h24: AlertWindowSummary;
  };
  totalPoints: number;
};

type QuantReport = {
  ok: boolean;
  windowHours: number;
  points: number;
  alerts: { red: number; amber: number; green: number };
  averages: { syncLag: number; qualityScore: number; velocityBlocksPerMin: number };
};

export default function DashboardPage() {
  const { isSpanish } = useLocale();
  const [snapshot, setSnapshot] = useState<CanonicalSnapshot | null>(null);
  const [history, setHistory] = useState<CanonicalSnapshot[]>([]);
  const [alerts, setAlerts] = useState<AlertPayload | null>(null);
  const [report, setReport] = useState<QuantReport | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let stopped = false;

    async function loadCanonicalKpi() {
      try {
        const [kpiRes, alertRes, reportRes] = await Promise.all([
          fetch("/api/quant/kpi", { cache: "no-store" }),
          fetch("/api/quant/alerts", { cache: "no-store" }),
          fetch("/api/quant/report?hours=24", { cache: "no-store" })
        ]);
        const data = await kpiRes.json();
        const alertData = await alertRes.json();
        const reportData = await reportRes.json();
        if (!stopped) {
          if (data?.ok) {
            setSnapshot(data.snapshot ?? null);
            setHistory(Array.isArray(data.history) ? data.history : []);
            if (alertData?.ok) {
              setAlerts(alertData as AlertPayload);
            }
            if (reportData?.ok) {
              setReport(reportData as QuantReport);
            }
            setError("");
          } else {
            setError(String(data?.error ?? (isSpanish ? "fallo endpoint KPI" : "kpi endpoint failed")));
          }
        }
      } catch (e) {
        if (!stopped) {
          setError(String(e));
        }
      }
    }

    loadCanonicalKpi();
    const timer = setInterval(loadCanonicalKpi, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const syncPercent = useMemo(() => {
    if (!snapshot) return "-";
    return `${snapshot.syncPercent.toFixed(2)}%`;
  }, [snapshot]);

  const integrityFlag = useMemo(() => {
    if (!snapshot) return "-";
    const ok =
      snapshot.integrity.monotonicIndexerHeight &&
      snapshot.integrity.targetNotBelowIndexer &&
      snapshot.integrity.watcherNotAheadIndexer;
    return ok ? (isSpanish ? "OK" : "Pass") : isSpanish ? "Fallo" : "Fail";
  }, [snapshot]);

  const etaLabel = useMemo(() => {
    if (!snapshot || snapshot.etaToTipMinutes == null) return "-";
    const minutes = snapshot.etaToTipMinutes;
    if (minutes < 60) return `${minutes.toFixed(1)}m`;
    const hours = minutes / 60;
    if (hours < 48) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  }, [snapshot]);

  const trendLag = useMemo(() => history.slice(-18).map((h) => h.syncLag), [history]);
  const trendQuality = useMemo(() => history.slice(-18).map((h) => h.qualityScore), [history]);
  const trendVelocity = useMemo(() => history.slice(-18).map((h) => h.velocityBlocksPerMin), [history]);
  const trendTrades = useMemo(() => history.slice(-18).map((h) => h.marketTrades), [history]);
  const trendOrderbook = useMemo(() => history.slice(-18).map((h) => h.orderbookNotional), [history]);
  const trendSync = useMemo(() => history.slice(-18).map((h) => h.syncPercent), [history]);

  return (
    <section className="space-y-4">
      <Navbar title="Overview" />
      <ModuleGuide
        whatThisDoes="This module is the global health dashboard for sync, quality, alerts, and service readiness."
        whatToTry="Start here, confirm all core health cards are stable, then move to specific modules (Market, BPVP20, OTC, etc.) for action tests."
        walletHint='Wallet linking is optional for most tests. If needed, use the wallet connect steps in "Profile".'
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2 xl:col-span-2">
          <EngineStatusCard />
        </div>
        <KpiCard label={isSpanish ? "Altura Bitcoin (Indexer)" : "Bitcoin Height (Indexer)"} value={snapshot?.indexerHeight ?? "-"} />
        <KpiCard label={isSpanish ? "Altura Objetivo Bitcoin" : "Bitcoin Target Height"} value={snapshot?.targetHeight ?? "-"} />
        <KpiCard label={isSpanish ? "Progreso Sync" : "Sync Progress"} value={syncPercent} trend={trendSync} tone="blue" />
        <KpiCard label={isSpanish ? "Bloques de Lag" : "Sync Lag Blocks"} value={snapshot?.syncLag ?? "-"} trend={trendLag} tone="rose" />
        <KpiCard label={isSpanish ? "Altura Engine" : "Engine Height"} value={snapshot?.engineHeight ?? "-"} />
        <KpiCard label={isSpanish ? "Ultimo Sync Watcher" : "Watcher Last Synced"} value={snapshot?.watcherHeight ?? "-"} />
        <KpiCard label={isSpanish ? "Acciones Enviadas" : "Actions Pushed"} value={snapshot?.actionsPushed ?? "-"} />
        <KpiCard label={isSpanish ? "Notional Orderbook" : "Orderbook Notional"} value={snapshot?.orderbookNotional?.toFixed(2) ?? "-"} trend={trendOrderbook} tone="violet" />
        <KpiCard label={isSpanish ? "Trades de Mercado" : "Market Trades"} value={snapshot?.marketTrades ?? "-"} trend={trendTrades} tone="amber" />
        <KpiCard label={isSpanish ? "Velocidad (bloques/min)" : "Velocity (blocks/min)"} value={snapshot?.velocityBlocksPerMin?.toFixed(3) ?? "-"} trend={trendVelocity} tone="green" />
        <KpiCard label={isSpanish ? "ETA a Tip" : "ETA to Tip"} value={etaLabel} />
        <KpiCard label={isSpanish ? "Puntaje de Calidad" : "Quality Score"} value={snapshot?.qualityScore ?? "-"} trend={trendQuality} tone="green" />
        <KpiCard label={isSpanish ? "Estado de Alerta" : "Alert Status"} value={snapshot?.alertStatus ?? "-"} />
        <KpiCard label={isSpanish ? "Chequeos de Integridad" : "Integrity Checks"} value={integrityFlag} />
        <KpiCard label={isSpanish ? "Servicios Saludables" : "Services Healthy"} value={snapshot?.servicesHealthy ? (isSpanish ? "Si" : "Yes") : isSpanish ? "No" : "No"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={isSpanish ? "Alertas ROJAS (15m)" : "RED Alerts (15m)"} value={alerts?.windows?.m15?.counts?.RED ?? "-"} />
        <KpiCard label={isSpanish ? "Alertas ROJAS (1h)" : "RED Alerts (1h)"} value={alerts?.windows?.h1?.counts?.RED ?? "-"} />
        <KpiCard label={isSpanish ? "Alertas ROJAS (6h)" : "RED Alerts (6h)"} value={alerts?.windows?.h6?.counts?.RED ?? "-"} />
        <KpiCard label={isSpanish ? "Ratio ROJO (24h)" : "RED Ratio (24h)"} value={alerts ? `${(alerts.windows.h24.redRatio * 100).toFixed(1)}%` : "-"} />
      </div>

      <Card title="Canonical KPI Trend (Lag vs Quality)">
        <KpiTrendChart data={history} />
      </Card>

      <Card title="Data Exports">
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/quant/history"
            className="rounded-md bg-bpvp-hover px-3 py-2 text-sm text-bpvp-ink hover:bg-bpvp-border-strong"
          >
            {isSpanish ? "Descargar Historial KPI CSV" : "Download KPI History CSV"}
          </a>
          <p className="text-sm text-bpvp-muted">
            {isSpanish ? "Puntos totales" : "Total points"}: {alerts?.totalPoints ?? history.length}
          </p>
        </div>
      </Card>

      <Card title="24h Quant Report">
        <div className="grid gap-3 md:grid-cols-3">
          <KpiCard label={isSpanish ? "Lag Sync Prom (24h)" : "Avg Sync Lag (24h)"} value={report ? report.averages.syncLag.toFixed(2) : "-"} />
          <KpiCard label={isSpanish ? "Calidad Prom (24h)" : "Avg Quality (24h)"} value={report ? report.averages.qualityScore.toFixed(2) : "-"} />
          <KpiCard label={isSpanish ? "Velocidad Prom (24h)" : "Avg Velocity (24h)"} value={report ? report.averages.velocityBlocksPerMin.toFixed(4) : "-"} />
        </div>
      </Card>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
