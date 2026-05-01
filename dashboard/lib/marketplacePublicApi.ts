import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/security";

function resolveAllowedOrigin(req: NextRequest) {
  const configured = process.env.BPVP_MARKETPLACE_CORS_ORIGIN || "*";
  if (configured === "*") return "*";
  const origin = req.headers.get("origin") ?? "";
  const allowed = configured
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || "null";
}

export function marketplaceCorsHeaders(req: NextRequest) {
  const allowedOrigin = resolveAllowedOrigin(req);
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-BPVP-Marketplace-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache"
  };
}

export function marketplaceOptionsResponse(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: marketplaceCorsHeaders(req)
  });
}

export function marketplaceRateLimit(req: NextRequest, key: string, max = 120) {
  const ip = getClientIp(req);
  return checkRateLimit(`${key}:${ip}`, max, 60_000);
}

function safeEq(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function requireMarketplaceWriteOrigin(req: NextRequest) {
  const configured = process.env.BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS ?? "";
  if (!configured.trim()) return null;
  const origin = req.headers.get("origin") ?? "";
  const allowed = configured
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) {
    return NextResponse.json(
      { ok: false, error: "origin not allowed for write action" },
      { status: 403, headers: marketplaceCorsHeaders(req) }
    );
  }
  return null;
}

export function requireMarketplaceWriteKey(req: NextRequest) {
  const configured = process.env.BPVP_MARKETPLACE_PUBLIC_API_KEY ?? "";
  if (!configured) {
    return NextResponse.json(
      { ok: false, error: "marketplace api key is not configured" },
      { status: 503, headers: marketplaceCorsHeaders(req) }
    );
  }
  const provided = req.headers.get("x-bpvp-marketplace-key") ?? "";
  if (!provided || !safeEq(provided, configured)) {
    return NextResponse.json(
      { ok: false, error: "invalid marketplace api key" },
      { status: 401, headers: marketplaceCorsHeaders(req) }
    );
  }
  return null;
}
