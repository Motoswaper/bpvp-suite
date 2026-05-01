import { NextResponse } from "next/server";

export const DID_SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};

const DID_RE = /^did:bpvp:[a-z0-9-]{8,}$/;
const SAFE_ID_RE = /^[a-zA-Z0-9._:-]{2,80}$/;
const WALLET_RE = /^(0x)?[a-fA-F0-9]{40}$/;

export function withDidHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(DID_SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export function isValidDid(did: string) {
  return DID_RE.test(did.trim().toLowerCase());
}

export function isValidSafeId(value: string) {
  return SAFE_ID_RE.test(value.trim());
}

export function isValidWalletAddress(value: string) {
  const raw = value.trim();
  return raw.length === 0 || WALLET_RE.test(raw);
}

export function sanitizeClaims(input: unknown): Record<string, string | number | boolean> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("claims must be a JSON object");
  }
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > 32) throw new Error("claims exceed max keys");
  const out: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    if (!isValidSafeId(key)) throw new Error("invalid claim key");
    const v = obj[key];
    if (typeof v === "string") {
      if (v.length > 300) throw new Error("claim string value too long");
      out[key] = v;
    } else if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error("invalid numeric claim");
      out[key] = v;
    } else if (typeof v === "boolean") {
      out[key] = v;
    } else {
      throw new Error("claim value type is not allowed");
    }
  }
  return out;
}
