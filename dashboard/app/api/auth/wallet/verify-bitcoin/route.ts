import bitcoinMessage from "bitcoinjs-message";
import { NextRequest, NextResponse } from "next/server";
import {
  buildSessionCookie,
  createSessionToken,
  getSessionFromRequest,
  verifyWalletChallenge
} from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";

function isTestnetFamilyAddress(address: string) {
  const value = address.toLowerCase().trim();
  return (
    value.startsWith("tb1") ||
    value.startsWith("m") ||
    value.startsWith("n") ||
    value.startsWith("2")
  );
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 });
  }
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(`wallet-verify-btc:${session.username}:${ip}`, 20, 60_000);
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
  if (signature.length > 4096) {
    return NextResponse.json({ ok: false, error: "signature too large" }, { status: 400 });
  }
  if (!isTestnetFamilyAddress(address)) {
    return NextResponse.json({ ok: false, error: "only signet/testnet address formats are allowed" }, { status: 400 });
  }

  const validNonce = verifyWalletChallenge(session.username, nonce);
  if (!validNonce) {
    return NextResponse.json({ ok: false, error: "invalid or expired challenge" }, { status: 400 });
  }

  const message = `BPVP wallet link nonce: ${nonce}`;
  let ok = false;
  try {
    // bitcoinjs-message expects a Bitcoin Signed Message signature.
    ok = bitcoinMessage.verify(message, address, signature);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid bitcoin signature format" }, { status: 400 });
  }
  if (!ok) {
    return NextResponse.json({ ok: false, error: "bitcoin signature verification failed" }, { status: 403 });
  }

  const token = createSessionToken({
    username: session.username,
    role: session.role,
    mfa: session.mfa,
    walletAddress: address,
    walletVerificationMethod: "bitcoin_message",
    walletNetwork: "signet-testnet"
  });
  const cookie = buildSessionCookie(token);
  const res = NextResponse.json({ ok: true, walletAddress: address, network: "signet/testnet" });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
