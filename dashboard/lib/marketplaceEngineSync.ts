import crypto from "crypto";

const engineBase = process.env.ENGINE_URL ?? "http://localhost:28080";
const apiKey = process.env.AXE_API_KEY ?? "";
const hmacSecret = process.env.AXE_HMAC_SECRET ?? "";

function signRequest(method: string, path: string, timestamp: string, body: string) {
  return crypto
    .createHmac("sha256", hmacSecret)
    .update(`${method}|${path}|${timestamp}|${body}`)
    .digest("hex");
}

async function postEngineAction(module: "market", type: string, data: Record<string, unknown>) {
  if (!apiKey || !hmacSecret) {
    return { ok: false as const, error: "engine_auth_not_configured" };
  }
  const path = "/actions";
  const body = JSON.stringify({ module, type, data });
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${engineBase}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-AXE-API-Key": apiKey,
        "X-AXE-Timestamp": timestamp,
        "X-AXE-Signature": signRequest("POST", path, timestamp, body)
      },
      body,
      cache: "no-store",
      signal: controller.signal
    });
    const raw = await res.text();
    if (!res.ok) {
      return { ok: false as const, error: `engine_http_${res.status}`, details: raw };
    }
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncMarketplaceListingToEngine(input: {
  listingId: string;
  tokenSymbol: string;
  quantity: number;
  priceBtc: number;
  seller: string;
}) {
  return postEngineAction("market", "order_open", {
    orderId: input.listingId,
    side: "sell",
    price: input.priceBtc,
    amount: input.quantity,
    pair: `${input.tokenSymbol}/BTC`,
    maker: input.seller,
    source: "bpvp_marketplace"
  });
}

export async function syncMarketplaceTradeToEngine(input: {
  tradeId: string;
  listingId: string;
  quantity: number;
  totalBtc: number;
  buyer: string;
  seller: string;
  tokenSymbol: string;
}) {
  const price = input.quantity > 0 ? Number((input.totalBtc / input.quantity).toFixed(8)) : 0;
  return postEngineAction("market", "order_fill", {
    tradeId: input.tradeId,
    orderId: input.listingId,
    price,
    amount: input.quantity,
    pair: `${input.tokenSymbol}/BTC`,
    buyer: input.buyer,
    seller: input.seller,
    source: "bpvp_marketplace"
  });
}
