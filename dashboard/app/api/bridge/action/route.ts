import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";
const apiKey = process.env.AXE_API_KEY ?? "";
const hmacSecret = process.env.AXE_HMAC_SECRET ?? "";
const bridgeOpsToken = process.env.BPVP_BRIDGE_OPS_TOKEN ?? "";
const bridgeWebhookURL = process.env.BPVP_BRIDGE_WEBHOOK_URL ?? "";
const bridgeWebhookSecret = process.env.BPVP_BRIDGE_WEBHOOK_SECRET ?? process.env.AXE_HMAC_SECRET ?? "";
const bridgeEnabled = (process.env.BPVP_ENABLE_BRIDGE ?? "false").toLowerCase() === "true";

function signRequest(method: string, path: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", hmacSecret).update(`${method}|${path}|${timestamp}|${body}`).digest("hex");
}

type Payload = {
  type: string;
  data?: Record<string, unknown>;
};

async function emitBridgeWebhook(event: {
  action: string;
  actor?: string;
  jobId?: number;
  status?: string;
  txHash?: string;
  error?: string;
}) {
  if (!bridgeWebhookURL || !bridgeWebhookSecret) return;
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const body = JSON.stringify({
    source: "bpvp-bridge-controller",
    timestamp: ts,
    ...event
  });
  const signature = crypto.createHmac("sha256", bridgeWebhookSecret).update(`${ts}|${body}`).digest("hex");
  await fetch(bridgeWebhookURL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-BPVP-Bridge-Signature": signature,
      "X-BPVP-Bridge-Timestamp": ts
    },
    body
  }).catch(() => {
    // Non-blocking notification path.
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    await writeSecurityEvent({
      category: "action",
      outcome: "denied",
      ip,
      route: "/api/bridge/action",
      reason: "invalid_origin"
    });
    return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  }
  const limit = checkRateLimit(`bridge-action:${ip}`, 60, 60_000);
  if (!limit.ok) {
    await writeSecurityEvent({
      category: "action",
      outcome: "denied",
      ip,
      route: "/api/bridge/action",
      reason: "rate_limited"
    });
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  if (!bridgeEnabled) {
    return NextResponse.json({ error: "bridge disabled (native-only mode)" }, { status: 404 });
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader"])) {
    await writeSecurityEvent({
      category: "action",
      outcome: "denied",
      actor: session?.username,
      role: session?.role,
      ip,
      route: "/api/bridge/action",
      reason: "unauthorized"
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const actorSession = session!;
  try {
    const payload = (await req.json()) as Payload;
    if (!payload?.type) return NextResponse.json({ error: "type is required" }, { status: 400 });

    const adminOnly = new Set([
      "bridge_set_policy",
      "bridge_approve_job",
      "bridge_mark_submitted",
      "bridge_mark_confirmed",
      "bridge_mark_failed"
    ]);
    if (adminOnly.has(payload.type) && !canAccess(session, ["admin"])) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/bridge/action",
        action: payload.type,
        reason: "admin_role_required"
      });
      return NextResponse.json({ error: "admin role required" }, { status: 403 });
    }
    if (adminOnly.has(payload.type) && !bridgeOpsToken) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/bridge/action",
        action: payload.type,
        reason: "bridge_ops_token_not_configured"
      });
      return NextResponse.json({ error: "bridge ops policy misconfigured" }, { status: 503 });
    }
    if (adminOnly.has(payload.type)) {
      const provided = req.headers.get("x-bpvp-ops-token") ?? "";
      if (!provided || provided !== bridgeOpsToken) {
        return NextResponse.json({ error: "bridge ops token required" }, { status: 403 });
      }
    }
    if (!apiKey || !hmacSecret) {
      await writeSecurityEvent({
        category: "action",
        outcome: "denied",
        actor: actorSession.username,
        role: actorSession.role,
        ip,
        route: "/api/bridge/action",
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
      route: "/api/bridge/action",
      action: payload.type
    });

    const data = { ...(payload.data ?? {}), requestedBy: session?.username };
    const body = JSON.stringify({
      module: "bpvp721",
      type: payload.type,
      data
    });
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const path = "/actions";
    const headers: Record<string, string> = { "content-type": "application/json" };
    headers["X-AXE-API-Key"] = apiKey;
    headers["X-AXE-Timestamp"] = timestamp;
    headers["X-AXE-Signature"] = signRequest("POST", path, timestamp, body);
    const upstream = await fetch(`${engineBase}${path}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store"
    });
    const raw = await upstream.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(raw);
    } catch {
      responseData = { raw };
    }
    const candidateStatusMap: Record<string, string> = {
      bridge_enqueue_mint: "queued",
      bridge_enqueue_burn: "queued",
      bridge_enqueue_sync: "queued",
      bridge_approve_job: "approved_or_pending",
      bridge_mark_submitted: "submitted",
      bridge_mark_confirmed: "confirmed",
      bridge_mark_failed: "failed"
    };
    await emitBridgeWebhook({
      action: payload.type,
      actor: session?.username,
      jobId: typeof payload.data?.jobId === "number" ? payload.data.jobId : undefined,
      status: candidateStatusMap[payload.type],
      txHash: typeof payload.data?.txHash === "string" ? payload.data.txHash : undefined,
      error: typeof payload.data?.error === "string" ? payload.data.error : undefined
    });
    return NextResponse.json(responseData, { status: upstream.status });
  } catch (error) {
    await writeSecurityEvent({
      category: "action",
      outcome: "error",
      actor: session?.username,
      role: session?.role,
      ip,
      route: "/api/bridge/action",
      reason: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "failed to apply bridge action", details: String(error) }, { status: 500 });
  }
}
