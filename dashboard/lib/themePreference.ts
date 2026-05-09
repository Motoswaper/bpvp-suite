export type ThemePreference = "light" | "dark";

/**
 * Client-side source of truth order:
 * 1) localStorage — survives when Set-Cookie is blocked or SSR cookie lags
 * 2) cookie — kept in sync for server-rendered `data-theme`
 * 3) server fallback from the last successful request
 */
export function resolveClientTheme(serverTheme: ThemePreference): ThemePreference {
  if (typeof window === "undefined") return serverTheme;
  try {
    const ls = localStorage.getItem("bpvp_theme");
    if (ls === "dark" || ls === "light") return ls;
  } catch {
    /* ignore */
  }
  const m = document.cookie.match(/(?:^|;\s*)bpvp_theme=(dark|light)/);
  if (m?.[1] === "dark" || m?.[1] === "light") return m[1];
  return serverTheme;
}

export function persistThemeCookie(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `bpvp_theme=${theme};path=/;max-age=${maxAge};SameSite=Lax${secure ? ";Secure" : ""}`;
}

export function applyThemeToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}
