import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { verifyDidCredential } from "@/lib/didStore";
import { withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp } from "@/lib/security";

type VerifyPayload = {
  credentialId?: string;
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`did-verify:${ip}`, 120, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader", "risk", "viewer"])) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  const payload = (await req.json().catch(() => ({}))) as VerifyPayload;
  const credentialId = String(payload.credentialId ?? "").trim();
  if (!credentialId) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "credentialId is required" }, { status: 400 }));
  }
  const result = await verifyDidCredential({ credentialId });
  return withDidHeaders(NextResponse.json({ ok: result.ok, result }));
}
