import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";
const apiKey = process.env.AXE_API_KEY ?? "";
const hmacSecret = process.env.AXE_HMAC_SECRET ?? "";

const ALLOWED_MODULES = new Set(["bpvp20", "bpvp721", "market", "trust", "lend", "settle", "otc"]);

function signRequest(method: string, path: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", hmacSecret).update(`${method}|${path}|${timestamp}|${body}`).digest("hex");
}

type Body = {
  module?: string;
  type?: string;
  data?: Record<string, unknown>;
};

function canExecuteAction(module: string, type: string, role: "admin" | "trader" | "risk" | "viewer") {
  if (role === "admin") return true;
  if (module === "otc") {
    const traderAllowed = new Set(["rfq_create", "quote_submit", "quote_accept"]);
    const riskAllowed = new Set(["trade_settle", "rfq_cancel"]);
    if (role === "trader" && traderAllowed.has(type)) return true;
    if (role === "risk" && riskAllowed.has(type)) return true;
    return false;
  }
  return role === "trader" || role === "risk";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!isSameOriginRequest(req)) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        ip,
        route: "/api/engine/action",
        reason: "invalid_origin"
      });
      return NextResponse.json({ error: "invalid origin" }, { status: 403 });
    }
    const limit = checkRateLimit(`engine-action:${ip}`, 90, 60_000);
    if (!limit.ok) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        ip,
        route: "/api/engine/action",
        reason: "rate_limited"
      });
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const session = getSessionFromRequest(req);
    if (!session || !canAccess(session, ["admin", "trader", "risk"])) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: session?.username,
        role: session?.role,
        ip,
        route: "/api/engine/action",
        reason: "unauthorized"
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const actorSession = session!;
    const role = actorSession.role;

    const payload = (await req.json()) as Body;
    const targetModule = String(payload.module ?? "").trim();
    const type = String(payload.type ?? "").trim();
    if (!targetModule || !type) {
      return NextResponse.json({ error: "module and type are required" }, { status: 400 });
    }
    if (!ALLOWED_MODULES.has(targetModule)) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/engine/action",
        action: type,
        reason: "module_not_allowed",
        details: { module: targetModule }
      });
      return NextResponse.json({ error: "module not allowed" }, { status: 403 });
    }
    if (!canExecuteAction(targetModule, type, role)) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/engine/action",
        action: type,
        reason: "role_not_allowed",
        details: { module: targetModule }
      });
      return NextResponse.json({ error: "role not allowed for action" }, { status: 403 });
    }
    await writeSecurityEvent({
      category: "action",
      outcome: "allowed",
      actor: actorSession.username,
      role: actorSession.role,
      ip,
      route: "/api/engine/action",
      action: type,
      details: { module: targetModule }
    });
    if (!apiKey || !hmacSecret) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/engine/action",
        action: type,
        reason: "upstream_auth_misconfigured"
      });
      return NextResponse.json({ error: "upstream auth policy misconfigured" }, { status: 503 });
    }

    const body = JSON.stringify({
      module: targetModule,
      type,
      data: payload.data && typeof payload.data === "object" ? payload.data : {}
    });

    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const path = "/actions";
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    headers["X-AXE-API-Key"] = apiKey;
    headers["X-AXE-Timestamp"] = timestamp;
    headers["X-AXE-Signature"] = signRequest("POST", path, timestamp, body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(`${engineBase}${path}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    const raw = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    await writeSecurityEvent({
      category: "action",
      outcome: "error",
      ip: getClientIp(req),
      route: "/api/engine/action",
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "failed to apply engine action", details: String(error) },
      { status: 500 }
    );
  }
}
