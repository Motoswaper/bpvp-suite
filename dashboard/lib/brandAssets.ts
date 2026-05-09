export const BRAND_ASSETS = {
  /** Primary mark for light theme. */
  logo: "/brand/bpvp-hand-logo-light.png",
  /** Primary mark for dark theme. */
  logoDark: "/brand/bpvp-hand-logo.png",
  /** Wide strip for landing + module headers; swap file for a dedicated wide crop when ready. */
  heroBanner: "/brand/hero-banner.png",
  /** Optional 1200×630 for social previews; falls back to `logo` in metadata until added. */
  openGraphPng: "/brand/bpvp-og.png"
} as const;
