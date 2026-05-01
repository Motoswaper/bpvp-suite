import { verifyMessage } from "ethers";
import { NextRequest, NextResponse } from "next/server";
import {
  buildSessionCookie,
  createSessionToken,
  getSessionFromRequest,
  verifyWalletChallenge
} from "@/lib/auth";
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
  const limit = checkRateLimit(`wallet-verify-evm:${session.username}:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const address = String(body.address ?? "").trim();
  const nonce = String(body.nonce ?? "").trim();
  const signature = String(body.signature ?? "").trim();
  if (!address || !nonce || !signature) {
    return NextResponse.json({ ok: false, error: "address, nonce, signature required" }, { status: 400 });
  }
  if (signature.length > 2048) {
    return NextResponse.json({ ok: false, error: "signature too large" }, { status: 400 });
  }

  const validNonce = verifyWalletChallenge(session.username, nonce);
  if (!validNonce) {
    return NextResponse.json({ ok: false, error: "invalid or expired challenge" }, { status: 400 });
  }

  const message = `BPVP wallet link nonce: ${nonce}`;
  let recovered = "";
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid signature format" }, { status: 400 });
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "signature does not match address" }, { status: 403 });
  }

  const token = createSessionToken({
    username: session.username,
    role: session.role,
    mfa: session.mfa,
    walletAddress: recovered,
    walletVerificationMethod: "evm_personal_sign",
    walletNetwork: "evm-test"
  });
  const cookie = buildSessionCookie(token);
  const res = NextResponse.json({ ok: true, walletAddress: recovered });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
