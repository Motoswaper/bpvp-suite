import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Snapshot = {
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

type HistoryPayload = {
  snapshots: Snapshot[];
};

type AlertState = {
  lastAlertStatus?: "GREEN" | "AMBER" | "RED";
  lastNotifiedTs?: number;
};

const HISTORY_LIMIT = 240;
const historyFile = path.resolve(process.cwd(), "..", ".run", "bpvp-kpi-history.json");
const alertStateFile = path.resolve(process.cwd(), "..", ".run", "bpvp-alert-state.json");

const cfg = {
  redQualityScore: toNumber(process.env.BPVP_ALERT_RED_QUALITY_SCORE || 70),
  amberQualityScore: toNumber(process.env.BPVP_ALERT_AMBER_QUALITY_SCORE || 85),
  redSyncLag: toNumber(process.env.BPVP_ALERT_RED_SYNC_LAG || 100000),
  amberSyncLag: toNumber(process.env.BPVP_ALERT_AMBER_SYNC_LAG || 10000),
  amberVelocityBlocksPerMin: toNumber(process.env.BPVP_ALERT_AMBER_VELOCITY_BPM || 0.05),
  qualityLagPenaltyThreshold: toNumber(process.env.BPVP_QUALITY_LAG_PENALTY_THRESHOLD || 1000),
  qualityLagPenaltyValue: toNumber(process.env.BPVP_QUALITY_LAG_PENALTY_VALUE || 10),
  qualityServicePenalty: toNumber(process.env.BPVP_QUALITY_SERVICE_PENALTY || 40),
  qualityMonotonicPenalty: toNumber(process.env.BPVP_QUALITY_MONOTONIC_PENALTY || 25),
  qualityWatcherAheadPenalty: toNumber(process.env.BPVP_QUALITY_WATCHER_AHEAD_PENALTY || 20),
  qualityTargetBelowPenalty: toNumber(process.env.BPVP_QUALITY_TARGET_BELOW_PENALTY || 10),
  velocityWindowPoints: Math.max(2, Math.floor(toNumber(process.env.BPVP_VELOCITY_WINDOW_POINTS || 12))),
  historyRetentionDays: Math.max(1, Math.floor(toNumber(process.env.BPVP_HISTORY_RETENTION_DAYS || 7))),
  alertWebhookUrl: process.env.BPVP_ALERT_WEBHOOK_URL || "",
  alertWebhookSecret: process.env.BPVP_ALERT_WEBHOOK_SECRET || "",
  alertNotifyMinIntervalSec: Math.max(1, Math.floor(toNumber(process.env.BPVP_ALERT_NOTIFY_MIN_INTERVAL_SEC || 300))),
  alertNotifyOnStatusChangeOnly: String(process.env.BPVP_ALERT_NOTIFY_ON_STATUS_CHANGE_ONLY || "true") === "true"
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchUpstream(url: string) {
  const headers: Record<string, string> = {};
  if (process.env.AXE_API_KEY) {
    headers["X-AXE-API-Key"] = process.env.AXE_API_KEY;
  }
  const res = await fetch(url, { cache: "no-store", headers });
  const raw = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  return { ok: res.ok, status: res.status, data: parsed };
}

async function loadHistory(): Promise<Snapshot[]> {
  try {
    const raw = await fs.readFile(historyFile, "utf8");
    const parsed = JSON.parse(raw) as HistoryPayload;
    const snapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots : [];
    const cutoff = Date.now() - cfg.historyRetentionDays * 24 * 60 * 60 * 1000;
    return snapshots.filter((s) => Number(s.ts || 0) >= cutoff);
  } catch {
    return [];
  }
}

async function saveHistory(snapshots: Snapshot[]) {
  await fs.mkdir(path.dirname(historyFile), { recursive: true });
  const payload: HistoryPayload = { snapshots };
  await fs.writeFile(historyFile, JSON.stringify(payload, null, 2), "utf8");
}

async function loadAlertState(): Promise<AlertState> {
  try {
    const raw = await fs.readFile(alertStateFile, "utf8");
    return JSON.parse(raw) as AlertState;
  } catch {
    return {};
  }
}

async function saveAlertState(state: AlertState) {
  await fs.mkdir(path.dirname(alertStateFile), { recursive: true });
  await fs.writeFile(alertStateFile, JSON.stringify(state, null, 2), "utf8");
}

function computeVelocityBlocksPerMin(history: Snapshot[], currentHeight: number, currentTs: number) {
  const window = history.slice(-cfg.velocityWindowPoints);
  if (window.length === 0) return 0;
  const oldest = window[0];
  const deltaBlocks = Math.max(0, currentHeight - oldest.indexerHeight);
  const deltaMinutes = Math.max(0.001, (currentTs - oldest.ts) / 60000);
  return deltaBlocks / deltaMinutes;
}

function computeAlertStatus(params: {
  servicesHealthy: boolean;
  qualityScore: number;
  syncLag: number;
  velocityBlocksPerMin: number;
}) {
  if (!params.servicesHealthy || params.qualityScore < cfg.redQualityScore || params.syncLag > cfg.redSyncLag) {
    return "RED" as const;
  }
  if (
    params.qualityScore < cfg.amberQualityScore ||
    params.syncLag > cfg.amberSyncLag ||
    params.velocityBlocksPerMin < cfg.amberVelocityBlocksPerMin
  ) {
    return "AMBER" as const;
  }
  return "GREEN" as const;
}

async function maybeSendAlertWebhook(snapshot: Snapshot) {
  if (!cfg.alertWebhookUrl) {
    return { sent: false, reason: "webhook_disabled" as const };
  }

  const now = Date.now();
  const state = await loadAlertState();
  const changed = state.lastAlertStatus !== snapshot.alertStatus;
  const intervalMs = cfg.alertNotifyMinIntervalSec * 1000;
  const intervalSatisfied = !state.lastNotifiedTs || now - state.lastNotifiedTs >= intervalMs;

  let shouldSend = intervalSatisfied;
  if (cfg.alertNotifyOnStatusChangeOnly) {
    shouldSend = changed && intervalSatisfied;
  }

  if (!shouldSend) {
    return { sent: false, reason: "rate_limited_or_unchanged" as const };
  }

  const payload = {
    source: "bpvp-canonical-kpi",
    ts: snapshot.ts,
    alertStatus: snapshot.alertStatus,
    qualityScore: snapshot.qualityScore,
    syncLag: snapshot.syncLag,
    velocityBlocksPerMin: snapshot.velocityBlocksPerMin,
    etaToTipMinutes: snapshot.etaToTipMinutes,
    servicesHealthy: snapshot.servicesHealthy
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(cfg.alertWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.alertWebhookSecret ? { "x-bpvp-alert-secret": cfg.alertWebhookSecret } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (res.ok) {
      await saveAlertState({ lastAlertStatus: snapshot.alertStatus, lastNotifiedTs: now });
      return { sent: true, reason: "ok" as const };
    }
    return { sent: false, reason: "webhook_http_error" as const, status: res.status };
  } catch {
    return { sent: false, reason: "webhook_failed" as const };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";
    const indexerBase = process.env.INDEXER_URL ?? "http://localhost:28081";
    const watcherBase = process.env.WATCHER_URL ?? "http://localhost:28082";

    const [engineStatus, engineMarket, indexerStatus, watcherStatus] = await Promise.all([
      fetchUpstream(`${engineBase}/status`),
      fetchUpstream(`${engineBase}/state/market`),
      fetchUpstream(`${indexerBase}/status`),
      fetchUpstream(`${watcherBase}/status`)
    ]);

    const engine = engineStatus.data?.engine ?? {};
    const indexer = indexerStatus.data?.indexer ?? {};
    const watcher = watcherStatus.data?.watcher ?? {};
    const marketState = engineMarket.data?.state ?? engineMarket.data ?? {};

    const bids = Array.isArray(marketState.bids) ? marketState.bids : [];
    const asks = Array.isArray(marketState.asks) ? marketState.asks : [];
    const trades = Array.isArray(marketState.trades) ? marketState.trades : [];

    const orderbookNotional = [...bids, ...asks].reduce((acc, order) => {
      return acc + toNumber(order?.price) * toNumber(order?.amount);
    }, 0);

    const indexerHeight = toNumber(indexer.height);
    const targetHeight = toNumber(indexer.targetHeight);
    const watcherHeight = toNumber(watcher.lastSyncedHeight);
    const syncLag = Math.max(0, targetHeight - indexerHeight);
    const syncPercent = targetHeight > 0 ? Math.min(100, (indexerHeight / targetHeight) * 100) : 0;

    const history = await loadHistory();
    const previous = history[history.length - 1];
    const nowTs = Date.now();

    const integrity = {
      monotonicIndexerHeight: previous ? indexerHeight >= previous.indexerHeight : true,
      watcherNotAheadIndexer: watcherHeight <= indexerHeight,
      targetNotBelowIndexer: targetHeight >= indexerHeight
    };

    const servicesHealthy =
      engineStatus.ok &&
      indexerStatus.ok &&
      watcherStatus.ok &&
      Boolean(indexer.indexerHealthy) &&
      Boolean(indexer.bitcoinHealthy) &&
      Boolean(watcher.syncLagHealthy);

    let qualityScore = 100;
    if (!servicesHealthy) qualityScore -= cfg.qualityServicePenalty;
    if (!integrity.monotonicIndexerHeight) qualityScore -= cfg.qualityMonotonicPenalty;
    if (!integrity.watcherNotAheadIndexer) qualityScore -= cfg.qualityWatcherAheadPenalty;
    if (!integrity.targetNotBelowIndexer) qualityScore -= cfg.qualityTargetBelowPenalty;
    if (syncLag > cfg.qualityLagPenaltyThreshold) qualityScore -= cfg.qualityLagPenaltyValue;
    qualityScore = Math.max(0, qualityScore);

    const velocityBlocksPerMin = computeVelocityBlocksPerMin(history, indexerHeight, nowTs);
    const etaToTipMinutes = velocityBlocksPerMin > 0 ? syncLag / velocityBlocksPerMin : null;
    const alertStatus = computeAlertStatus({
      servicesHealthy,
      qualityScore,
      syncLag,
      velocityBlocksPerMin
    });

    const snapshot: Snapshot = {
      ts: nowTs,
      engineHeight: toNumber(engine.height),
      indexerHeight,
      targetHeight,
      watcherHeight,
      syncLag,
      syncPercent,
      marketTrades: trades.length,
      orderbookNotional,
      actionsPushed: toNumber(watcher.actionsPushed),
      servicesHealthy,
      integrity,
      qualityScore,
      velocityBlocksPerMin,
      etaToTipMinutes,
      alertStatus
    };

    const nextHistory = [...history, snapshot].slice(-HISTORY_LIMIT);
    await saveHistory(nextHistory);
    const webhook = await maybeSendAlertWebhook(snapshot);

    return NextResponse.json({
      ok: true,
      snapshot,
      history: nextHistory,
      source: "canonical-kpi-v1",
      policy: {
        ...cfg,
        alertWebhookUrl: cfg.alertWebhookUrl ? "[configured]" : "[disabled]",
        alertWebhookSecret: cfg.alertWebhookSecret ? "[configured]" : "[disabled]"
      },
      webhook
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `failed to compute canonical kpi: ${String(error)}` },
      { status: 500 }
    );
  }
}
