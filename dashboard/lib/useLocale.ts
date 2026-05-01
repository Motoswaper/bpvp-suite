"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type Locale = "en" | "es";

function readLocaleFromBrowser(): Locale {
  if (typeof window === "undefined") return "en";
  const q = new URLSearchParams(window.location.search).get("lang");
  if (q === "es" || q === "en") return q;
  const cookieMatch = document.cookie.match(/(?:^|;\s*)bpvp_locale=(es|en)(?:;|$)/i);
  if (cookieMatch?.[1]) return cookieMatch[1].toLowerCase() === "es" ? "es" : "en";
  return document.documentElement.lang.toLowerCase().startsWith("es") ? "es" : "en";
}

export function useLocale() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [locale, setLocale] = useState<Locale>(() => readLocaleFromBrowser());

  useEffect(() => {
    const next = readLocaleFromBrowser();
    if (next !== locale) setLocale(next);
    // Re-evaluate after client route or query changes.
  }, [pathname, searchParams, locale]);

  const isSpanish = locale === "es";
  return { locale, isSpanish };
}
