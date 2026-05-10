import { ClearLoginRedirectMarkers } from "@/components/auth/ClearLoginRedirectMarkers";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Sidebar } from "@/components/layout/Sidebar";
import type { BpvpLocale } from "@/lib/bpvpLocale";
import type { ThemePreference } from "@/lib/themePreference";
import type { ReactNode } from "react";

export function Shell({
  children,
  locale,
  theme
}: {
  children: ReactNode;
  locale: BpvpLocale;
  theme: ThemePreference;
}) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-bpvp-page text-bpvp-ink">
      <ClearLoginRedirectMarkers />
      <Sidebar />
      <div className="flex min-h-screen flex-col border-l border-bpvp-border bg-bpvp-page">
        <div className="flex shrink-0 justify-end border-b border-bpvp-border bg-bpvp-page/95 px-4 py-2">
          <LanguageSwitcher currentLocale={locale} currentTheme={theme} />
        </div>
        <main className="min-h-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
