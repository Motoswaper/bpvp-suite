import { NextRequest, NextResponse } from "next/server";
import {
  createMarketplaceListing,
  listMarketplaceListings
} from "@/lib/marketplaceStore";
import { syncMarketplaceListingToEngine } from "@/lib/marketplaceEngineSync";
import {
  marketplaceCorsHeaders,
  marketplaceOptionsResponse,
  marketplaceRateLimit,
  requireMarketplaceWriteOrigin,
  requireMarketplaceWriteKey
} from "@/lib/marketplacePublicApi";

type CreateListingPayload = {
  seller?: string;
  tokenSymbol?: string;
  quantity?: number;
  priceBtc?: number;
};

export async function OPTIONS(req: NextRequest) {
  return marketplaceOptionsResponse(req);
}

export async function GET(req: NextRequest) {
  const limit = marketplaceRateLimit(req, "mkt-public-listings-read", 300);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "too many requests" },
      { status: 429, headers: marketplaceCorsHeaders(req) }
    );
  }
  const listings = await listMarketplaceListings();
  return NextResponse.json(
    { ok: true, listings },
    { headers: marketplaceCorsHeaders(req) }
  );
}

export async function POST(req: NextRequest) {
  const limit = marketplaceRateLimit(req, "mkt-public-listings-write", 80);
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

  const payload = (await req.json().catch(() => ({}))) as CreateListingPayload;
  const seller = String(payload.seller ?? "").trim();
  const tokenSymbol = String(payload.tokenSymbol ?? "").trim().toUpperCase();
  const quantity = Number(payload.quantity ?? 0);
  const priceBtc = Number(payload.priceBtc ?? 0);

  if (!seller || !tokenSymbol || !Number.isFinite(quantity) || !Number.isFinite(priceBtc)) {
    return NextResponse.json(
      { ok: false, error: "invalid payload" },
      { status: 400, headers: marketplaceCorsHeaders(req) }
    );
  }
  if (quantity <= 0 || priceBtc <= 0) {
    return NextResponse.json(
      { ok: false, error: "quantity and priceBtc must be > 0" },
      { status: 400, headers: marketplaceCorsHeaders(req) }
    );
  }

  const listing = await createMarketplaceListing({
    seller,
    tokenSymbol,
    quantity,
    priceBtc
  });
  const engineSync = await syncMarketplaceListingToEngine({
    listingId: listing.id,
    seller: listing.seller,
    tokenSymbol: listing.tokenSymbol,
    quantity: listing.quantity,
    priceBtc: listing.priceBtc
  });
  return NextResponse.json(
    { ok: true, listing, engineSync },
    { status: 201, headers: marketplaceCorsHeaders(req) }
  );
}
