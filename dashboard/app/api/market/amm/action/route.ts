import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";
const apiKey = process.env.AXE_API_KEY ?? "";
const hmacSecret = process.env.AXE_HMAC_SECRET ?? "";
const opsToken = process.env.BPVP_AMM_OPS_TOKEN ?? "";

type ActionPayload = {
  type: string;
  data?: Record<string, unknown>;
};

function signRequest(method: string, path: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", hmacSecret).update(`${method}|${path}|${timestamp}|${body}`).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!isSameOriginRequest(req)) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        ip,
        route: "/api/market/amm/action",
        reason: "invalid_origin"
      });
      return NextResponse.json({ error: "invalid origin" }, { status: 403 });
    }
    const limit = checkRateLimit(`amm-action:${ip}`, 90, 60_000);
    if (!limit.ok) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        ip,
        route: "/api/market/amm/action",
        reason: "rate_limited"
      });
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const session = getSessionFromRequest(req);
    if (!canAccess(session, ["admin", "trader"])) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: session?.username,
        role: session?.role,
        ip,
        route: "/api/market/amm/action",
        reason: "unauthorized"
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const actorSession = session!;

    const payload = (await req.json()) as ActionPayload;
    if (!payload?.type) {
      return NextResponse.json({ error: "action type is required" }, { status: 400 });
    }
    const sensitiveActions = new Set([
      "amm_set_policy",
      "amm_reset_circuit_breaker",
      "amm_set_trader_limit"
    ]);
    if (sensitiveActions.has(payload.type) && !canAccess(session, ["admin"])) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/market/amm/action",
        action: payload.type,
        reason: "admin_role_required"
      });
      return NextResponse.json({ error: "admin role required for sensitive action" }, { status: 403 });
    }
    if (sensitiveActions.has(payload.type) && !opsToken) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/market/amm/action",
        action: payload.type,
        reason: "ops_token_not_configured"
      });
      return NextResponse.json({ error: "ops policy misconfigured" }, { status: 503 });
    }
    if (sensitiveActions.has(payload.type)) {
      const provided = req.headers.get("x-bpvp-ops-token") ?? "";
      if (!provided || provided !== opsToken) {
        return NextResponse.json({ error: "ops token required for sensitive action" }, { status: 403 });
      }
    }
    if (!apiKey || !hmacSecret) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/market/amm/action",
        action: payload.type,
        reason: "upstream_auth_misconfigured"
      });
      return NextResponse.json({ error: "upstream auth policy misconfigured" }, { status: 503 });
    }
    await writeSecurityEvent({
      category: "action",
      outcome: "allowed",
      actor: actorSession.username,
      role: actorSession.role,
      ip,
      route: "/api/market/amm/action",
      action: payload.type
    });

    const baseData = payload.data ?? {};
    const nonce = crypto.randomUUID();
    const nonceTs = Math.floor(Date.now() / 1000);
    const actionData = {
      ...baseData,
      nonce,
      nonceTs
    };

    const body = JSON.stringify({
      module: "market",
      type: payload.type,
      data: actionData
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
    const timeout = setTimeout(() => controller.abort(), 8000);
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
      route: "/api/market/amm/action",
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: "failed to apply AMM action", details: String(error) },
      { status: 500 }
    );
  }
}
