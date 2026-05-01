import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, issueWalletChallenge } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 });
  }
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(`wallet-challenge:${session.username}:${ip}`, 12, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const challenge = issueWalletChallenge(session.username);
  const message = `BPVP wallet link nonce: ${challenge.nonce}`;
  return NextResponse.json({
    ok: true,
    challenge: {
      nonce: challenge.nonce,
      message,
      statement: challenge.statement,
      issuedAt: challenge.requestedAt
    }
  });
}
