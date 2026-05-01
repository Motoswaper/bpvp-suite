import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Snapshot = {
  ts?: number;
  engineHeight?: number;
  indexerHeight?: number;
  targetHeight?: number;
  watcherHeight?: number;
  syncLag?: number;
  syncPercent?: number;
  marketTrades?: number;
  orderbookNotional?: number;
  actionsPushed?: number;
  servicesHealthy?: boolean;
  qualityScore?: number;
  velocityBlocksPerMin?: number;
  etaToTipMinutes?: number | null;
  alertStatus?: "GREEN" | "AMBER" | "RED";
};

const historyFile = path.resolve(process.cwd(), "..", ".run", "bpvp-kpi-history.json");

function safe(val: unknown) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  let snapshots: Snapshot[] = [];
  try {
    const raw = await fs.readFile(historyFile, "utf8");
    const parsed = JSON.parse(raw);
    snapshots = Array.isArray(parsed?.snapshots) ? parsed.snapshots : [];
  } catch {
    snapshots = [];
  }

  const header = [
    "ts",
    "isoTime",
    "engineHeight",
    "indexerHeight",
    "targetHeight",
    "watcherHeight",
    "syncLag",
    "syncPercent",
    "marketTrades",
    "orderbookNotional",
    "actionsPushed",
    "servicesHealthy",
    "qualityScore",
    "velocityBlocksPerMin",
    "etaToTipMinutes",
    "alertStatus"
  ];

  const rows = snapshots.map((s) => [
    safe(s.ts),
    safe(s.ts ? new Date(s.ts).toISOString() : ""),
    safe(s.engineHeight),
    safe(s.indexerHeight),
    safe(s.targetHeight),
    safe(s.watcherHeight),
    safe(s.syncLag),
    safe(s.syncPercent),
    safe(s.marketTrades),
    safe(s.orderbookNotional),
    safe(s.actionsPushed),
    safe(s.servicesHealthy),
    safe(s.qualityScore),
    safe(s.velocityBlocksPerMin),
    safe(s.etaToTipMinutes),
    safe(s.alertStatus)
  ]);

  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=bpvp-kpi-history.csv"
    }
  });
}
