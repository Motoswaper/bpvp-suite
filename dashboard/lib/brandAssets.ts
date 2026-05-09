export const BRAND_ASSETS = {
  /** Primary mark for light theme (replace with final hand art when ready). */
  logo: "/brand/bitcoin-corner-photo.jpg",
  /** Primary mark for dark theme. */
  logoDark: "/brand/bitcoin-corner-photo.jpg",
  /** Wide strip for landing + module headers; swap file for a dedicated wide crop when ready. */
  heroBanner: "/brand/hero-banner.png",
  /** Optional 1200×630 for social previews; falls back to `logo` in metadata until added. */
  openGraphPng: "/brand/bpvp-og.png"
} as const;
