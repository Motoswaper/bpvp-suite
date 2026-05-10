"use client";

import { applyThemeToDocument, resolveClientTheme, type ThemePreference } from "@/lib/themePreference";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";

/**
 * Re-applies theme from localStorage/cookie (server must not set data-theme on the html element — RSC overwrites it).
 */
export function ThemeSync({ serverTheme }: { serverTheme: ThemePreference }) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    applyThemeToDocument(resolveClientTheme(serverTheme));
  }, [serverTheme, pathname]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "bpvp_theme" || e.key === null) {
        applyThemeToDocument(resolveClientTheme(serverTheme));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [serverTheme]);

  return null;
}
