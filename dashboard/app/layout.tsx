import "@/styles/globals.css";
import { StaticLocaleProvider } from "@/components/layout/LocaleGate";
import { ThemeBoot } from "@/components/layout/ThemeBoot";
import { ConditionalMarketingChrome } from "@/components/layout/ConditionalMarketingChrome";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { BRAND_ASSETS } from "@/lib/brandAssets";
import { getServerLocale } from "@/lib/serverLocale";
import { getPublicSiteUrl } from "@/lib/siteUrl";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ReactNode } from "react";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BPVP Suite | Bitcoin-Native DeFi Operating Layer",
    template: "%s | BPVP Suite"
  },
  description:
    "BPVP Suite is a Bitcoin-native DeFi operating layer delivered as modular infrastructure for market execution, identity, trust, lending, settlement, and auditable BTC workflows.",
  keywords: [
    "Bitcoin",
    "BTC",
    "DeFi",
    "BTC-Fi",
    "Bitcoin DeFi",
    "BPVP",
    "Bitcoin operating layer",
    "Crypto market operations"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "BPVP Suite | Bitcoin-Native DeFi Operating Layer",
    description:
      "A Bitcoin-native DeFi operating layer delivered as modular infrastructure with auditable market, identity, trust, lending, and settlement workflows.",
    url: siteUrl,
    siteName: "BPVP Suite",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: BRAND_ASSETS.logo,
        width: 1200,
        height: 630,
        alt: "BPVP Suite"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "BPVP Suite | Bitcoin-Native DeFi Operating Layer",
    description:
      "A Bitcoin-native DeFi operating layer delivered as modular infrastructure with auditable workflows.",
    images: [BRAND_ASSETS.logo]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale();
  const cookieStore = await cookies();
  const themeRaw = String(cookieStore.get("bpvp_theme")?.value ?? "").toLowerCase();
  const theme = themeRaw === "dark" ? "dark" : "light";

  return (
    // Do not set data-theme here — RSC updates would overwrite the client's night/day toggle.
    // ThemeBoot (inline script) + ThemeSync apply data-theme from localStorage/cookie.
    <html lang={locale} data-bpvp-locale={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-bpvp-page text-bpvp-ink antialiased">
        <ThemeBoot />
        <ThemeSync serverTheme={theme} />
        <ConditionalMarketingChrome locale={locale} theme={theme}>
          <StaticLocaleProvider locale={locale}>{children}</StaticLocaleProvider>
        </ConditionalMarketingChrome>
      </body>
    </html>
  );
}
