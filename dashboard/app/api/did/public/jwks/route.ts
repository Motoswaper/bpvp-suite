import { NextRequest, NextResponse } from "next/server";
import { getDidIssuerPublicJwks } from "@/lib/didIssuerCrypto";
import { withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`did-public-jwks:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const issuer = getDidIssuerPublicJwks();
  return withDidHeaders(
    NextResponse.json({
      ok: true,
      activeKid: issuer.activeKid,
      keys: issuer.keys
    })
  );
}
