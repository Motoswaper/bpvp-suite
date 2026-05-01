import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
const base = process.env.INDEXER_URL ?? "http://localhost:28081";

function resolveAllowedPath(rawPath: string) {
  if (!rawPath.startsWith("/")) return null;
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(rawPath)) return null;
  if (rawPath === "/status") return rawPath;
  return null;
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const requestedPath = req.nextUrl.searchParams.get("path") ?? "/status";
  const path = resolveAllowedPath(requestedPath);
  if (!path) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
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
      { error: "indexer upstream unavailable", details: String(error) },
      { status: 503 }
    );
  }
}
