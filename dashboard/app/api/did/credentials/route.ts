import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { issueDidCredential, listDidCredentials } from "@/lib/didStore";
import { isValidDid, isValidSafeId, sanitizeClaims, withDidHeaders } from "@/lib/didSecurity";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

type IssueCredentialPayload = {
  subjectDid?: string;
  type?: string;
  claims?: string;
  expiresAt?: string;
};

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader", "risk", "viewer"])) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(`did-credentials-read:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const credentials = await listDidCredentials();
  return withDidHeaders(NextResponse.json({ ok: true, credentials }));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 }));
  }
  const limit = checkRateLimit(`did-credentials-write:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 }));
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "risk"])) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }));
  }
  const payload = (await req.json().catch(() => ({}))) as IssueCredentialPayload;
  const subjectDid = String(payload.subjectDid ?? "").trim();
  const type = String(payload.type ?? "").trim();
  if (!subjectDid || !type) {
    return withDidHeaders(
      NextResponse.json({ ok: false, error: "subjectDid and type are required" }, { status: 400 })
    );
  }
  if (!isValidDid(subjectDid)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid DID format" }, { status: 400 }));
  }
  if (!isValidSafeId(type)) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid credential type" }, { status: 400 }));
  }

  let claims: Record<string, string | number | boolean> = {};
  if (payload.claims) {
    try {
      const parsed = JSON.parse(String(payload.claims));
      claims = sanitizeClaims(parsed);
    } catch {
      return withDidHeaders(NextResponse.json({ ok: false, error: "claims must be valid JSON object" }, { status: 400 }));
    }
  }
  if (payload.expiresAt && Number.isNaN(Date.parse(String(payload.expiresAt)))) {
    return withDidHeaders(NextResponse.json({ ok: false, error: "invalid expiresAt datetime" }, { status: 400 }));
  }
  try {
    const credential = await issueDidCredential({
      subjectDid,
      type,
      claims,
      issuer: session!.username,
      expiresAt: payload.expiresAt ? String(payload.expiresAt) : undefined
    });
    await writeSecurityEvent({
      category: "action",
      outcome: "allowed",
      actor: session!.username,
      role: session!.role,
      ip,
      route: "/api/did/credentials",
      action: "issue_did_credential",
      details: { credentialId: credential.id, subjectDid }
    });
    return withDidHeaders(NextResponse.json({ ok: true, credential }, { status: 201 }));
  } catch (error) {
    return withDidHeaders(
      NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "failed_to_issue_credential" },
        { status: 400 }
      )
    );
  }
}
