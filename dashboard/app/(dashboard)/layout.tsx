import { Shell } from "@/components/layout/Shell";
import { getServerLocale } from "@/lib/serverLocale";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import type { ThemePreference } from "@/lib/themePreference";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale();
  const cookieStore = await cookies();
  const themeRaw = String(cookieStore.get("bpvp_theme")?.value ?? "").toLowerCase();
  const theme: ThemePreference = themeRaw === "dark" ? "dark" : "light";

  return (
    <Shell locale={locale} theme={theme}>
      {children}
    </Shell>
  );
}
