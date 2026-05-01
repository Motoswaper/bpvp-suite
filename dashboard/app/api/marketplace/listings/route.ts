import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import {
  createMarketplaceListing,
  listMarketplaceListings
} from "@/lib/marketplaceStore";
import { syncMarketplaceListingToEngine } from "@/lib/marketplaceEngineSync";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

type CreateListingPayload = {
  seller?: string;
  tokenSymbol?: string;
  quantity?: number;
  priceBtc?: number;
};

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`mkt-listings-read:${ip}`, 240, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader", "risk", "viewer"])) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const listings = await listMarketplaceListings();
  return NextResponse.json({ ok: true, listings });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!isSameOriginRequest(req)) {
    await writeSecurityEvent({
      category: "action",
      outcome: "denied",
      ip,
      route: "/api/marketplace/listings",
      reason: "invalid_origin"
    });
    return NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 });
  }
  const limit = checkRateLimit(`mkt-listings-write:${ip}`, 80, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin", "trader"])) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as CreateListingPayload;
  const seller = String(payload.seller ?? "").trim();
  const tokenSymbol = String(payload.tokenSymbol ?? "").trim().toUpperCase();
  const quantity = Number(payload.quantity ?? 0);
  const priceBtc = Number(payload.priceBtc ?? 0);
  if (!seller || !tokenSymbol || !Number.isFinite(quantity) || !Number.isFinite(priceBtc)) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }
  if (quantity <= 0 || priceBtc <= 0) {
    return NextResponse.json({ ok: false, error: "quantity and priceBtc must be > 0" }, { status: 400 });
  }

  const listing = await createMarketplaceListing({ seller, tokenSymbol, quantity, priceBtc });
  const engineSync = await syncMarketplaceListingToEngine({
    listingId: listing.id,
    seller: listing.seller,
    tokenSymbol: listing.tokenSymbol,
    quantity: listing.quantity,
    priceBtc: listing.priceBtc
  });
  await writeSecurityEvent({
    category: "action",
    outcome: "allowed",
    actor: session!.username,
    role: session!.role,
    ip,
    route: "/api/marketplace/listings",
    action: "create_listing",
    details: {
      listingId: listing.id,
      tokenSymbol,
      engineSyncOk: engineSync.ok,
      engineSyncError: engineSync.ok ? undefined : engineSync.error
    }
  });
  return NextResponse.json({ ok: true, listing, engineSync }, { status: 201 });
}
