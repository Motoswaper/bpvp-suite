import { NextResponse } from "next/server";

const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";
const bridgeEnabled = (process.env.BPVP_ENABLE_BRIDGE ?? "false").toLowerCase() === "true";

export async function GET() {
  if (!bridgeEnabled) {
    return NextResponse.json({ error: "bridge disabled (native-only mode)" }, { status: 404 });
  }
  try {
    const res = await fetch(`${engineBase}/state/bpvp721`, { cache: "no-store" });
    const raw = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "failed to fetch bridge state", details: String(error) }, { status: 500 });
  }
}
