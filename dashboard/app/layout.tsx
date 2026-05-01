import "@/styles/globals.css";
import { DeploymentBanner } from "@/components/layout/DeploymentBanner";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
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
    "BPVP Suite is a Bitcoin-native DeFi operating layer for BTC, BTC-Fi, market operations, settlement, bridge orchestration, and institutional-grade controls.",
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
      "Operate BTC-Fi with auditable modules for market, trust, lending, settlement, and bridge workflows.",
    url: siteUrl,
    siteName: "BPVP Suite",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/brand/bpvp-suite-logo.svg",
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
      "Operate BTC-Fi with auditable modules for market, trust, lending, settlement, and bridge workflows.",
    images: ["/brand/bpvp-suite-logo.svg"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const localeRaw = String(cookieStore.get("bpvp_locale")?.value ?? "").toLowerCase();
  const locale = localeRaw === "es" ? "es" : "en";

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-[#0b0f18]">
        <DeploymentBanner />
        <LanguageSwitcher currentLocale={locale} />
        {children}
        <GlobalFooter locale={locale} />
      </body>
    </html>
  );
}
