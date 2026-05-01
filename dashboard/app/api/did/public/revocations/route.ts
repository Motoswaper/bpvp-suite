import { NextRequest, NextResponse } from "next/server";
import { listDidRevocations } from "@/lib/didStore";
import { withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`did-public-revocations:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const revocations = await listDidRevocations();
  return withDidHeaders(
    NextResponse.json({
      ok: true,
      revocationListType: "StatusList2021-lite",
      revocations
    })
  );
}
