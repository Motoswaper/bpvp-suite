/**
 * Canonical public origin (HTTPS, no trailing slash) for metadata, sitemap, robots, JSON-LD.
 * Override per deploy with NEXT_PUBLIC_BPVP_SITE_URL.
 */
const DEFAULT_PUBLIC_SITE_URL = "https://testnet.btc-defi.com";

export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BPVP_SITE_URL?.trim();
  if (!raw) return DEFAULT_PUBLIC_SITE_URL;
  return raw.replace(/\/+$/, "");
}
