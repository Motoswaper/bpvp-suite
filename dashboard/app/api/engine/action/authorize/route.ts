import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest, normalizeUserRole, type UserRole } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

export const dynamic = "force-dynamic";

const ALLOWED_MODULES = new Set(["bpvp20", "bpvp721", "market", "trust", "lend", "settle", "otc"]);

type Body = {
  module?: string;
  type?: string;
};

function canExecuteAction(module: string, type: string, role: UserRole) {
  if (role === "admin") return true;
  if (module === "otc") {
    const traderAllowed = new Set(["rfq_create", "quote_submit", "quote_accept"]);
    const riskAllowed = new Set(["trade_settle", "rfq_cancel"]);
    if (role === "operator") {
      return traderAllowed.has(type) || riskAllowed.has(type);
    }
    if (role === "trader" && traderAllowed.has(type)) return true;
    if (role === "risk" && riskAllowed.has(type)) return true;
    return false;
  }
  return role === "trader" || role === "risk" || role === "operator";
}

async function handleAuthorize(req: NextRequest, targetModule: string, type: string) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    await writeSecurityEvent({
      category: "action",
      outcome: "denied",
      ip,
      route: "/api/engine/action/authorize",
      reason: "invalid_origin"
    });
    return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  }

  const limit = checkRateLimit(`engine-action-authz:${ip}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const session = getSessionFromRequest(req);
  if (!session || !canAccess(session, ["admin", "trader", "risk", "operator"])) {
    await writeSecurityEvent({
      category: "action",
      outcome: "denied",
      actor: session?.username,
      role: session?.role,
      ip,
      route: "/api/engine/action/authorize",
      reason: "unauthorized"
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!targetModule || !type) {
    return NextResponse.json({ error: "module and type are required" }, { status: 400 });
  }
  if (!ALLOWED_MODULES.has(targetModule)) {
    return NextResponse.json({ error: "module not allowed" }, { status: 403 });
  }
  const role = normalizeUserRole(String(session.role));
  if (!canExecuteAction(targetModule, type, role)) {
    return NextResponse.json({ error: "role not allowed for action" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, authorized: true }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  try {
    const targetModule = String(req.nextUrl.searchParams.get("module") ?? "").trim();
    const type = String(req.nextUrl.searchParams.get("type") ?? "").trim();
    return await handleAuthorize(req, targetModule, type);
  } catch (error) {
    await writeSecurityEvent({
      category: "action",
      outcome: "error",
      ip,
      route: "/api/engine/action/authorize",
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "authorization check failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  try {
    const payload = (await req.json()) as Body;
    const targetModule = String(payload.module ?? "").trim();
    const type = String(payload.type ?? "").trim();
    return await handleAuthorize(req, targetModule, type);
  } catch (error) {
    await writeSecurityEvent({
      category: "action",
      outcome: "error",
      ip,
      route: "/api/engine/action/authorize",
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "authorization check failed" }, { status: 500 });
  }
}
