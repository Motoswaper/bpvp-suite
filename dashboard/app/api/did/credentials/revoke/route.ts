import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { revokeDidCredential } from "@/lib/didStore";
import { withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

type RevokePayload = {
  credentialId?: string;
  reason?: string;
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 }));
  }
  const limit = checkRateLimit(`did-credentials-revoke:${ip}`, 40, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin"])) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }

  const payload = (await req.json().catch(() => ({}))) as RevokePayload;
  const credentialId = String(payload.credentialId ?? "").trim();
  if (!credentialId) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "credentialId is required" }, { status: 400 }));
  }
  if (credentialId.length > 120) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "credentialId too long" }, { status: 400 }));
  }
  if (payload.reason && String(payload.reason).length > 200) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "reason too long" }, { status: 400 }));
  }
  try {
    const credential = await revokeDidCredential({ credentialId, reason: payload.reason });
    await writeSecurityEvent({
      category: "action",
      outcome: "allowed",
      actor: session!.username,
      role: session!.role,
      ip,
      route: "/api/did/credentials/revoke",
      action: "revoke_did_credential",
      details: { credentialId }
    });
    return withDidHeaders(NextResponse.json({ ok: true, credential }));
  } catch (error) {
    return withDidHeaders(
      NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "failed_to_revoke_credential" },
        { status: 400 }
      )
    );
  }
}
