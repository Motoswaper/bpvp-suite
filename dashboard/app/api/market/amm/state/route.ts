import { NextResponse } from "next/server";

const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";

export async function GET() {
  try {
    const res = await fetch(`${engineBase}/state/market`, { cache: "no-store" });
    const raw = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: "upstream returned non-json response", raw };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "engine upstream unavailable", details: String(error) },
      { status: 503 }
    );
  }
}
