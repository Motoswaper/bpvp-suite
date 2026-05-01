import { promises as fs } from "fs";
import crypto from "crypto";
import path from "path";

export type MarketplaceListing = {
  id: string;
  seller: string;
  tokenSymbol: string;
  quantity: number;
  priceBtc: number;
  status: "open" | "filled" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceTrade = {
  id: string;
  listingId: string;
  buyer: string;
  seller: string;
  tokenSymbol: string;
  quantity: number;
  totalBtc: number;
  status: "pending_settlement" | "settled";
  createdAt: string;
};

type MarketplaceStore = {
  listings: MarketplaceListing[];
  trades: MarketplaceTrade[];
  updatedAt: string;
};

const storePath = path.resolve(process.cwd(), "..", ".run", "marketplace-public.json");

function initialStore(): MarketplaceStore {
  return {
    listings: [],
    trades: [],
    updatedAt: new Date().toISOString()
  };
}

async function readStore(): Promise<MarketplaceStore> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as MarketplaceStore;
    if (!Array.isArray(parsed.listings) || !Array.isArray(parsed.trades)) {
      return initialStore();
    }
    return parsed;
  } catch {
    return initialStore();
  }
}

async function writeStore(store: MarketplaceStore) {
  const dir = path.dirname(storePath);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
}

export async function listMarketplaceListings() {
  const store = await readStore();
  return store.listings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listMarketplaceTrades() {
  const store = await readStore();
  return store.trades.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createMarketplaceListing(input: {
  seller: string;
  tokenSymbol: string;
  quantity: number;
  priceBtc: number;
}) {
  const store = await readStore();
  const now = new Date().toISOString();
  const listing: MarketplaceListing = {
    id: `lst_${crypto.randomUUID()}`,
    seller: input.seller,
    tokenSymbol: input.tokenSymbol,
    quantity: input.quantity,
    priceBtc: input.priceBtc,
    status: "open",
    createdAt: now,
    updatedAt: now
  };
  store.listings.push(listing);
  store.updatedAt = now;
  await writeStore(store);
  return listing;
}

export async function createMarketplaceTrade(input: {
  listingId: string;
  buyer: string;
  quantity: number;
}) {
  const store = await readStore();
  const listing = store.listings.find((l) => l.id === input.listingId);
  if (!listing) {
    throw new Error("listing_not_found");
  }
  if (listing.status !== "open") {
    throw new Error("listing_not_open");
  }
  if (input.quantity <= 0 || input.quantity > listing.quantity) {
    throw new Error("invalid_quantity");
  }
  const now = new Date().toISOString();
  const trade: MarketplaceTrade = {
    id: `trd_${crypto.randomUUID()}`,
    listingId: listing.id,
    buyer: input.buyer,
    seller: listing.seller,
    tokenSymbol: listing.tokenSymbol,
    quantity: input.quantity,
    totalBtc: Number((input.quantity * listing.priceBtc).toFixed(8)),
    status: "pending_settlement",
    createdAt: now
  };
  listing.quantity = Number((listing.quantity - input.quantity).toFixed(8));
  listing.status = listing.quantity <= 0 ? "filled" : "open";
  listing.updatedAt = now;
  store.trades.push(trade);
  store.updatedAt = now;
  await writeStore(store);
  return { trade, listing };
}
