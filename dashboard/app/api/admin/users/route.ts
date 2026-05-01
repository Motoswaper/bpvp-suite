import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest, listUsersSafe, setUserEnabled, upsertUser, UserRole } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

function parseRole(role: unknown): UserRole {
  const r = String(role ?? "viewer");
  if (r === "admin" || r === "trader" || r === "risk" || r === "viewer") return r;
  return "viewer";
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin"])) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, users: listUsersSafe() });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      ip: getClientIp(req),
      route: "/api/admin/users",
      reason: "invalid_origin"
    });
    return NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 });
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(`admin-users:${ip}`, 30, 60_000);
  if (!limit.ok) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      ip,
      route: "/api/admin/users",
      reason: "rate_limited"
    });
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin"])) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      actor: session?.username,
      role: session?.role,
      ip,
      route: "/api/admin/users",
      reason: "unauthorized"
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const adminSession = session!;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    if (action === "upsert") {
      const username = String(body.username ?? "").trim();
      const role = parseRole(body.role);
      const password = body.password ? String(body.password) : undefined;
      const otpSecret = body.otpSecret ? String(body.otpSecret) : undefined;
      const enabled = body.enabled !== false;
      const expectedStepup = process.env.BPVP_ADMIN_STEPUP_TOKEN ?? "";
      if (expectedStepup && (role === "admin" || body.resetPassword === true)) {
        const provided = req.headers.get("x-bpvp-stepup-token") ?? "";
        if (!provided || provided !== expectedStepup) {
          await writeSecurityEvent({
            category: "admin",
            outcome: "denied",
            actor: adminSession.username,
            role: adminSession.role,
            ip,
            route: "/api/admin/users",
            action: "upsert",
            reason: "stepup_required"
          });
          return NextResponse.json({ ok: false, error: "step-up token required" }, { status: 403 });
        }
      }
      upsertUser({ username, role, password, otpSecret, enabled });
      await writeSecurityEvent({
        category: "admin",
        outcome: "allowed",
        actor: adminSession.username,
        role: adminSession.role,
        ip,
        route: "/api/admin/users",
        action: "upsert",
        details: { username, role, enabled }
      });
      return NextResponse.json({ ok: true, users: listUsersSafe() });
    }
    if (action === "setEnabled") {
      const username = String(body.username ?? "").trim();
      const enabled = Boolean(body.enabled);
      setUserEnabled(username, enabled);
      await writeSecurityEvent({
        category: "admin",
        outcome: "allowed",
        actor: adminSession.username,
        role: adminSession.role,
        ip,
        route: "/api/admin/users",
        action: "setEnabled",
        details: { username, enabled }
      });
      return NextResponse.json({ ok: true, users: listUsersSafe() });
    }
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      actor: adminSession.username,
      role: adminSession.role,
      ip,
      route: "/api/admin/users",
      action,
      reason: "invalid_action"
    });
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "error",
      actor: adminSession.username,
      role: adminSession.role,
      ip,
      route: "/api/admin/users",
      action,
      reason: error instanceof Error ? error.message : "Request failed"
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
