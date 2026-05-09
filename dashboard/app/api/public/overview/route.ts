import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";

function baseUrlFromRequest(req: NextRequest): string {
  const origin = req.nextUrl.origin;
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`public-overview:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }

  const baseUrl = baseUrlFromRequest(req);
  const endpoints = {
    site: `${baseUrl}/`,
    sitemap: `${baseUrl}/sitemap.xml`,
    robots: `${baseUrl}/robots.txt`,
    authSession: `${baseUrl}/api/auth/session`,
    overview: `${baseUrl}/api/public/overview`,
    didJwks: `${baseUrl}/api/did/public/jwks`,
    marketplaceListings: `${baseUrl}/api/marketplace/public/listings`,
    marketplaceTrades: `${baseUrl}/api/marketplace/public/trades`
  };

  return NextResponse.json({
    ok: true,
    mode: "public_read_only",
    service: "bpvp-dashboard",
    network: "testnet/signet-facing",
    authRequired: {
      forOverview: false,
      forProtectedOperations: true
    },
    aiUsage: {
      allowedWithoutAccount: true,
      allowedMethods: ["GET"],
      note: "No privileged actions, wallet operations, or admin endpoints are exposed."
    },
    endpoints,
    timestamp: new Date().toISOString()
  });
}
