import "@/styles/globals.css";
import { StaticLocaleProvider } from "@/components/layout/LocaleGate";
import { ThemeBoot } from "@/components/layout/ThemeBoot";
import { DeploymentBanner } from "@/components/layout/DeploymentBanner";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
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
    <html lang={locale} data-theme={theme} data-bpvp-locale={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-bpvp-page text-bpvp-ink antialiased">
        <ThemeBoot />
        <DeploymentBanner />
        <header className="sticky top-0 z-50 border-b border-bpvp-border bg-bpvp-page/95 backdrop-blur supports-[backdrop-filter]:bg-bpvp-page/80">
          <div className="mx-auto flex max-w-6xl items-center justify-end px-3 py-2">
            <LanguageSwitcher currentLocale={locale} currentTheme={theme} />
          </div>
        </header>
        <StaticLocaleProvider locale={locale}>{children}</StaticLocaleProvider>
        <GlobalFooter locale={locale} />
      </body>
    </html>
  );
}
