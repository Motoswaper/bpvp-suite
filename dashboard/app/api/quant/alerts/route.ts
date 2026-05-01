import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Snapshot = {
  ts: number;
  alertStatus?: "GREEN" | "AMBER" | "RED";
  qualityScore?: number;
  syncLag?: number;
  velocityBlocksPerMin?: number;
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

function summarize(windowMs: number, snapshots: Snapshot[]) {
  const now = Date.now();
  const inWindow = snapshots.filter((s) => now - Number(s.ts || 0) <= windowMs);
  const counts = { GREEN: 0, AMBER: 0, RED: 0 };
  for (const s of inWindow) {
    const key = s.alertStatus;
    if (key === "GREEN" || key === "AMBER" || key === "RED") counts[key] += 1;
  }

  const latest = inWindow[inWindow.length - 1] ?? null;
  return {
    points: inWindow.length,
    counts,
    redRatio: inWindow.length > 0 ? counts.RED / inWindow.length : 0,
    latest: latest
      ? {
          ts: latest.ts,
          alertStatus: latest.alertStatus ?? "GREEN",
          qualityScore: Number(latest.qualityScore ?? 0),
          syncLag: Number(latest.syncLag ?? 0),
          velocityBlocksPerMin: Number(latest.velocityBlocksPerMin ?? 0)
        }
      : null
  };
}

export async function GET() {
  const snapshots = await loadSnapshots();
  return NextResponse.json({
    ok: true,
    windows: {
      m15: summarize(15 * 60 * 1000, snapshots),
      h1: summarize(60 * 60 * 1000, snapshots),
      h6: summarize(6 * 60 * 60 * 1000, snapshots),
      h24: summarize(24 * 60 * 60 * 1000, snapshots)
    },
    totalPoints: snapshots.length
  });
}
