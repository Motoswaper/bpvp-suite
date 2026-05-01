import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import {
  createMarketplaceTrade,
  listMarketplaceTrades
} from "@/lib/marketplaceStore";
import { syncMarketplaceTradeToEngine } from "@/lib/marketplaceEngineSync";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

type CreateTradePayload = {
  listingId?: string;
  buyer?: string;
  quantity?: number;
};

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`mkt-trades-read:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader", "risk", "viewer"])) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const trades = await listMarketplaceTrades();
  return NextResponse.json({ ok: true, trades });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    await writeSecurityEvent({
      category: "action",
      outcome: "denied",
      ip,
      route: "/api/marketplace/trades",
      reason: "invalid_origin"
    });
    return NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 });
  }
  const limit = checkRateLimit(`mkt-trades-write:${ip}`, 80, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader"])) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as CreateTradePayload;
  const listingId = String(payload.listingId ?? "").trim();
  const buyer = String(payload.buyer ?? "").trim();
  const quantity = Number(payload.quantity ?? 0);
  if (!listingId || !buyer || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }
  try {
    const result = await createMarketplaceTrade({ listingId, buyer, quantity });
    const engineSync = await syncMarketplaceTradeToEngine({
      tradeId: result.trade.id,
      listingId: result.trade.listingId,
      quantity: result.trade.quantity,
      totalBtc: result.trade.totalBtc,
      buyer: result.trade.buyer,
      seller: result.trade.seller,
      tokenSymbol: result.trade.tokenSymbol
    });
    await writeSecurityEvent({
      category: "action",
      outcome: "allowed",
      actor: session!.username,
      role: session!.role,
      ip,
      route: "/api/marketplace/trades",
      action: "create_trade",
      details: {
        tradeId: result.trade.id,
        listingId,
        engineSyncOk: engineSync.ok,
        engineSyncError: engineSync.ok ? undefined : engineSync.error
      }
    });
    return NextResponse.json(
      { ok: true, trade: result.trade, listing: result.listing, engineSync },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "trade_failed" },
      { status: 400 }
    );
  }
}
