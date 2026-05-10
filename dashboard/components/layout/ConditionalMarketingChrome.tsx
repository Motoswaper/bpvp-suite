"use client";

import type { BpvpLocale } from "@/lib/bpvpLocale";
import type { ThemePreference } from "@/lib/themePreference";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DeploymentBanner } from "@/components/layout/DeploymentBanner";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

/**
 * Landing/login/wallet keep the marketing banner + lang strip + footer.
 * Authenticated app routes (sidebar shell) should not stack that chrome above Shell — it felt like a double header and crushed usable space.
 */
export function ConditionalMarketingChrome({
  locale,
  theme,
  children
}: {
  locale: BpvpLocale;
  theme: ThemePreference;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const showMarketingChrome =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/login-basic" ||
    pathname === "/wallet";

  if (!showMarketingChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <DeploymentBanner />
      <header className="sticky top-0 z-50 border-b border-bpvp-border bg-bpvp-page/95 backdrop-blur supports-[backdrop-filter]:bg-bpvp-page/80">
        <div className="mx-auto flex max-w-6xl items-center justify-end px-3 py-2">
          <LanguageSwitcher currentLocale={locale} currentTheme={theme} />
        </div>
      </header>
      {children}
      <GlobalFooter locale={locale} />
    </>
  );
}
