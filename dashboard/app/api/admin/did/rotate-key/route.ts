import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { rotateDidIssuerKey } from "@/lib/didIssuerCrypto";
import { withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 }));
  }
  const limit = checkRateLimit(`did-key-rotate:${ip}`, 10, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin"])) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  const expectedStepup = process.env.BPVP_ADMIN_STEPUP_TOKEN ?? "";
  if (!expectedStepup) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "step-up policy misconfigured" }, { status: 503 }));
  }
  const provided = req.headers.get("x-bpvp-stepup-token") ?? "";
  if (!provided || provided !== expectedStepup) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "step-up token required" }, { status: 403 }));
  }
  try {
    const rotated = rotateDidIssuerKey();
    await writeSecurityEvent({
      category: "admin",
      outcome: "allowed",
      actor: session!.username,
      role: session!.role,
      ip,
      route: "/api/admin/did/rotate-key",
      action: "rotate_did_issuer_key",
      details: rotated
    });
    return withDidHeaders(NextResponse.json({ ok: true, rotated }));
  } catch (error) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "error",
      actor: session!.username,
      role: session!.role,
      ip,
      route: "/api/admin/did/rotate-key",
      action: "rotate_did_issuer_key",
      reason: error instanceof Error ? error.message : String(error)
    });
    return withDidHeaders(
      NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "rotate_failed" },
        { status: 500 }
      )
    );
  }
}
