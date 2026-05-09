"use client";

import {
  applyThemeToDocument,
  persistThemeCookie,
  resolveClientTheme,
  type ThemePreference
} from "@/lib/themePreference";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

type Locale = "en" | "es";
type Theme = ThemePreference;
type SessionState =
  | { connected: false; role: null; username: null }
  | { connected: true; role: string; username: string };

function readSearchString(): string {
  if (typeof window === "undefined") return "";
  return window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search;
}

export function LanguageSwitcher({
  currentLocale,
  currentTheme
}: {
  currentLocale: Locale;
  currentTheme: Theme;
}) {
  const label = currentLocale === "es" ? "Idioma" : "Lang";
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [sessionState, setSessionState] = useState<SessionState>({
    connected: false,
    role: null,
    username: null
  });

  const refreshSearch = useCallback(() => {
    setSearch(readSearchString());
  }, []);

  useEffect(() => {
    refreshSearch();
  }, [pathname, refreshSearch]);

  /** Re-apply stored preference after hydration / route changes (RSC may reset <html data-theme>). */
  useLayoutEffect(() => {
    const resolved = resolveClientTheme(currentTheme);
    setTheme(resolved);
    applyThemeToDocument(resolved);
  }, [currentTheme, pathname]);

  useEffect(() => {
    const onPop = () => refreshSearch();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [refreshSearch]);

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });
        if (!active) return;
        if (!res.ok) {
          setSessionState({ connected: false, role: null, username: null });
          return;
        }
        const body = await res.json().catch(() => ({}));
        const username = String(body?.session?.username ?? "").trim();
        const role = String(body?.session?.role ?? "").trim();
        if (!username || !role) {
          setSessionState({ connected: false, role: null, username: null });
          return;
        }
        setSessionState({ connected: true, role, username });
      } catch {
        if (!active) return;
        setSessionState({ connected: false, role: null, username: null });
      } finally {
        window.clearTimeout(timeout);
      }
    };

    loadSession();
    const timer = window.setInterval(loadSession, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pathname, search]);

  const buildHref = (targetLocale: Locale) => {
    const params = new URLSearchParams(search || undefined);
    params.set("lang", targetLocale);
    const query = params.toString();
    return query ? `${pathname}?${query}` : `${pathname}?lang=${targetLocale}`;
  };

  const statusLabel = sessionState.connected
    ? currentLocale === "es"
      ? `Conectado · rol ${sessionState.role} · ${sessionState.username}`
      : `Connected · role ${sessionState.role} · ${sessionState.username}`
    : currentLocale === "es"
      ? "No conectado"
      : "Not connected";

  const logoutLabel = currentLocale === "es" ? "Cerrar sesion" : "Log out";
  const themeLabel = theme === "dark" ? (currentLocale === "es" ? "Dia" : "Light") : currentLocale === "es" ? "Noche" : "Night";

  const onToggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyThemeToDocument(next);
    persistThemeCookie(next);
    try {
      localStorage.setItem("bpvp_theme", next);
    } catch {
      /* ignore */
    }
  };

  const onLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.href = currentLocale === "es" ? "/login?lang=es" : "/login?lang=en";
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-bpvp-border bg-bpvp-card/95 px-2 py-1 text-xs text-bpvp-muted shadow-sm backdrop-blur">
      <span
        className={`rounded px-2 py-1 font-medium ${
          sessionState.connected
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-stone-100 text-stone-700 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        {statusLabel}
      </span>
      {sessionState.connected ? (
        <button
          type="button"
          onClick={onLogout}
          className="rounded border border-rose-400/60 bg-rose-50 px-2 py-1 font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
        >
          {logoutLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggleTheme}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-bpvp-ink/90 hover:bg-bpvp-hover"
        title={currentLocale === "es" ? "Cambiar tema" : "Toggle theme"}
      >
        <span className="text-sm leading-none" aria-hidden>
          {theme === "dark" ? "☀️" : "🌙"}
        </span>
        <span className="font-medium">{themeLabel}</span>
      </button>
      <span className="hidden h-4 w-px bg-bpvp-border sm:inline-block" aria-hidden />
      <span>{label}</span>
      <a
        href={buildHref("en")}
        className={`rounded px-2 py-1 ${
          currentLocale === "en" ? "bg-blue-600 text-white dark:bg-blue-700" : "hover:bg-bpvp-hover"
        }`}
      >
        EN
      </a>
      <a
        href={buildHref("es")}
        className={`rounded px-2 py-1 ${
          currentLocale === "es" ? "bg-blue-600 text-white dark:bg-blue-700" : "hover:bg-bpvp-hover"
        }`}
      >
        ES
      </a>
    </div>
  );
}
