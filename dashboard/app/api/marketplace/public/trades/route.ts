import { NextRequest, NextResponse } from "next/server";
import {
  createMarketplaceTrade,
  listMarketplaceTrades
} from "@/lib/marketplaceStore";
import { syncMarketplaceTradeToEngine } from "@/lib/marketplaceEngineSync";
import {
  marketplaceCorsHeaders,
  marketplaceOptionsResponse,
  marketplaceRateLimit,
  requireMarketplaceWriteOrigin,
  requireMarketplaceWriteKey
} from "@/lib/marketplacePublicApi";

type CreateTradePayload = {
  listingId?: string;
  buyer?: string;
  quantity?: number;
};

export async function OPTIONS(req: NextRequest) {
  return marketplaceOptionsResponse(req);
}

export async function GET(req: NextRequest) {
  const limit = marketplaceRateLimit(req, "mkt-public-trades-read", 300);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "too many requests" },
      { status: 429, headers: marketplaceCorsHeaders(req) }
    );
  }
  const trades = await listMarketplaceTrades();
  return NextResponse.json(
    { ok: true, trades },
    { headers: marketplaceCorsHeaders(req) }
  );
}

export async function POST(req: NextRequest) {
  const limit = marketplaceRateLimit(req, "mkt-public-trades-write", 80);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "too many requests" },
      { status: 429, headers: marketplaceCorsHeaders(req) }
    );
  }
  const originError = requireMarketplaceWriteOrigin(req);
  if (originError) return originError;
  const authError = requireMarketplaceWriteKey(req);
  if (authError) return authError;

  const payload = (await req.json().catch(() => ({}))) as CreateTradePayload;
  const listingId = String(payload.listingId ?? "").trim();
  const buyer = String(payload.buyer ?? "").trim();
  const quantity = Number(payload.quantity ?? 0);

  if (!listingId || !buyer || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid payload" },
      { status: 400, headers: marketplaceCorsHeaders(req) }
    );
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
    return NextResponse.json(
      { ok: true, trade: result.trade, listing: result.listing, engineSync },
      { status: 201, headers: marketplaceCorsHeaders(req) }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "trade_failed" },
      { status: 400, headers: marketplaceCorsHeaders(req) }
    );
  }
}
