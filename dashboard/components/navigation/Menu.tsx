import Link from "next/link";
import { cookies } from "next/headers";
import { getSessionFromServerCookies } from "@/lib/auth";
const bridgeEnabled = (process.env.NEXT_PUBLIC_BPVP_ENABLE_BRIDGE ?? "false").toLowerCase() === "true";
const baseItems = [
  ["Overview", "/"],
  ["BPVP20", "/bpvp20"],
  ["BPVP721", "/bpvp721"],
  ["Market", "/market"],
  ["Marketplace", "/marketplace"],
  ["DID", "/did"],
  ["OTC", "/otc"],
  ...(bridgeEnabled ? ([["Bridge", "/bridge"]] as const) : []),
  ["Trust", "/trust"],
  ["Lend", "/lend"],
  ["Settle", "/settle"],
  ["Profile", "/profile"],
  ["Docs", "/docs"]
] as const;

const ES_LABEL_MAP: Record<string, string> = {
  Overview: "Resumen",
  Market: "Mercado",
  Marketplace: "Marketplace",
  DID: "DID",
  Bridge: "Bridge",
  Trust: "Confianza",
  Lend: "Prestamos",
  Settle: "Liquidacion",
  Profile: "Perfil",
  Docs: "Documentacion",
  Ops: "Ops"
};

export async function Menu() {
  const session = await getSessionFromServerCookies();
  const cookieStore = await cookies();
  const locale = String(cookieStore.get("bpvp_locale")?.value ?? "").toLowerCase();
  const isSpanish = locale === "es";
  const items = session?.role === "admin" ? [...baseItems, ["Ops", "/ops"] as const] : baseItems;
  return (
    <nav className="space-y-2">
      {items.map(([label, href]) => (
        <Link key={href} href={href} className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
          {isSpanish ? ES_LABEL_MAP[label] ?? label : label}
        </Link>
      ))}
    </nav>
  );
}
