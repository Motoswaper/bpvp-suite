"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { BpvpLocale } from "@/lib/bpvpLocale";

type Ctx = { locale: BpvpLocale };

export const LocaleContext = createContext<Ctx | null>(null);

/**
 * Locale from the server (cookies + `?lang=` via proxy header). No `useSearchParams`, so nothing
 * in this tree can suspend the whole page.
 */
export function StaticLocaleProvider({ locale, children }: { locale: BpvpLocale; children: ReactNode }) {
  const value = useMemo(() => ({ locale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext(): Ctx {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocaleContext must be used within StaticLocaleProvider");
  return ctx;
}
