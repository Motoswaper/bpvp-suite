import { cookies, headers } from "next/headers";
import { BPVP_LOCALE_HEADER, resolveBpvpLocale } from "@/lib/bpvpLocale";

export async function getServerLocale(options?: { queryLang?: string | string[] | null }) {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  return resolveBpvpLocale({
    queryLang: options?.queryLang,
    cookieValue: cookieStore.get("bpvp_locale")?.value,
    headerValue: hdrs.get(BPVP_LOCALE_HEADER)
  });
}
