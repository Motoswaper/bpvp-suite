import { NextRequest, NextResponse } from "next/server";
const base = process.env.ENGINE_URL ?? "http://localhost:18080";
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") ?? "/status";
  const headers: Record<string, string> = {};
  if (process.env.AXE_API_KEY) {
    headers["X-AXE-API-Key"] = process.env.AXE_API_KEY;
  }
  try {
    const res = await fetch(`${base}${path}`, { cache: "no-store", headers });
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
