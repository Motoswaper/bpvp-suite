import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { createDidIdentity, listDidIdentities } from "@/lib/didStore";
import { isValidSafeId, isValidWalletAddress, withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

type CreateIdentityPayload = {
  controller?: string;
  walletAddress?: string;
  label?: string;
};

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader", "risk", "viewer"])) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(`did-identities-read:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const identities = await listDidIdentities();
  return withDidHeaders(NextResponse.json({ ok: true, identities }));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 }));
  }
  const limit = checkRateLimit(`did-identities-write:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader"])) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  const payload = (await req.json().catch(() => ({}))) as CreateIdentityPayload;
  const controller = String(payload.controller ?? "").trim();
  const walletAddress = String(payload.walletAddress ?? "").trim();
  const label = String(payload.label ?? "").trim();
  if (!controller) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "controller is required" }, { status: 400 }));
  }
  if (!isValidSafeId(controller)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid controller format" }, { status: 400 }));
  }
  if (!isValidWalletAddress(walletAddress)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid wallet address" }, { status: 400 }));
  }
  if (label && label.length > 120) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "label too long" }, { status: 400 }));
  }
  const identity = await createDidIdentity({
    controller,
    walletAddress: walletAddress || undefined,
    label: label || undefined
  });
  await writeSecurityEvent({
    category: "action",
    outcome: "allowed",
    actor: session!.username,
    role: session!.role,
    ip,
    route: "/api/did/identities",
    action: "create_did_identity",
    details: { did: identity.did }
  });
  return withDidHeaders(NextResponse.json({ ok: true, identity }, { status: 201 }));
}
