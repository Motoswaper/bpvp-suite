import { NextRequest, NextResponse } from "next/server";
import { resolveDidIdentity } from "@/lib/didStore";
import { isValidDid, withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`did-public-resolve:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const did = String(req.nextUrl.searchParams.get("did") ?? "").trim();
  if (!did) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "did query param is required" }, { status: 400 }));
  }
  if (!isValidDid(did)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid did format" }, { status: 400 }));
  }
  const doc = await resolveDidIdentity(did);
  if (!doc) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "did_not_found" }, { status: 404 }));
  }
  return withDidHeaders(NextResponse.json({ ok: true, didDocument: doc }));
}
