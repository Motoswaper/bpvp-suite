import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Snapshot = {
  ts?: number;
  syncLag?: number;
  qualityScore?: number;
  velocityBlocksPerMin?: number;
  alertStatus?: "GREEN" | "AMBER" | "RED";
};

const historyFile = path.resolve(process.cwd(), "..", ".run", "bpvp-kpi-history.json");

async function loadSnapshots(): Promise<Snapshot[]> {
  try {
    const raw = await fs.readFile(historyFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.snapshots) ? parsed.snapshots : [];
  } catch {
    return [];
  }
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function GET(req: NextRequest) {
  const hours = Math.max(1, Number(req.nextUrl.searchParams.get("hours") ?? 24));
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1000;

  const snapshots = await loadSnapshots();
  const windowData = snapshots.filter((s) => Number(s.ts || 0) >= cutoff);

  const red = windowData.filter((s) => s.alertStatus === "RED").length;
  const amber = windowData.filter((s) => s.alertStatus === "AMBER").length;
  const green = windowData.filter((s) => s.alertStatus === "GREEN").length;

  const avgLag = avg(windowData.map((s) => Number(s.syncLag || 0)));
  const avgQuality = avg(windowData.map((s) => Number(s.qualityScore || 0)));
  const avgVelocity = avg(windowData.map((s) => Number(s.velocityBlocksPerMin || 0)));

  const latest = windowData[windowData.length - 1] ?? null;

  return NextResponse.json({
    ok: true,
    windowHours: hours,
    points: windowData.length,
    alerts: { red, amber, green },
    averages: {
      syncLag: avgLag,
      qualityScore: avgQuality,
      velocityBlocksPerMin: avgVelocity
    },
    latest
  });
}
