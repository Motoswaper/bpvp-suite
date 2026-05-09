/** Set on the request in middleware so layouts/pages match `?lang=` on the first hit (before cookie round-trip). */
export const BPVP_LOCALE_HEADER = "x-bpvp-locale";

export type BpvpLocale = "en" | "es";

export function parseLocaleParam(raw: string | string[] | undefined | null): BpvpLocale | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = String(v ?? "").toLowerCase();
  return s === "es" || s === "en" ? s : null;
}

export function resolveBpvpLocale(input: {
  queryLang?: string | string[] | null;
  cookieValue?: string | null | undefined;
  headerValue?: string | null;
}): BpvpLocale {
  const fromQuery = parseLocaleParam(input.queryLang ?? null);
  if (fromQuery) return fromQuery;
  const h = String(input.headerValue ?? "").toLowerCase();
  if (h === "es" || h === "en") return h;
  const c = String(input.cookieValue ?? "").toLowerCase();
  return c === "es" ? "es" : "en";
}
