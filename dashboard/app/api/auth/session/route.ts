import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    session: {
      username: session.username,
      role: session.role,
      mfa: session.mfa,
      walletAddress: session.walletAddress ?? null,
      walletVerificationMethod: session.walletVerificationMethod ?? null,
      walletNetwork: session.walletNetwork ?? null,
      exp: session.exp
    }
  });
}
