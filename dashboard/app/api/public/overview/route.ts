import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { getPublicSiteUrl } from "@/lib/siteUrl";

/**
 * Public canonical base URL for links in this JSON. Prefer Cloudflare / reverse-proxy
 * forwarded headers so tunnel traffic does not show up as http://localhost:3100.
 */
function baseUrlFromRequest(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost}`.replace(/\/+$/, "");
  }

  const origin = req.nextUrl.origin.replace(/\/+$/, "");
  if (/localhost|127\.0\.0\.1/i.test(origin)) {
    return getPublicSiteUrl();
  }
  return origin;
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
