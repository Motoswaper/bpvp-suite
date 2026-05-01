"use client";

import { usePathname, useSearchParams } from "next/navigation";

type Locale = "en" | "es";

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const label = currentLocale === "es" ? "Idioma" : "Lang";
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (targetLocale: Locale) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", targetLocale);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-md border border-slate-700 bg-[#0b0f18]/90 px-2 py-1 text-xs text-slate-300 backdrop-blur">
      <span>{label}</span>
      <a
        href={buildHref("en")}
        className={`rounded px-2 py-1 ${currentLocale === "en" ? "bg-blue-700 text-white" : "hover:bg-slate-800"}`}
      >
        EN
      </a>
      <a
        href={buildHref("es")}
        className={`rounded px-2 py-1 ${currentLocale === "es" ? "bg-blue-700 text-white" : "hover:bg-slate-800"}`}
      >
        ES
      </a>
    </div>
  );
}
