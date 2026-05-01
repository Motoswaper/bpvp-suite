"use client";

import { FormEvent, useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { useLocale } from "@/lib/useLocale";

type Listing = {
  id: string;
  seller: string;
  tokenSymbol: string;
  quantity: number;
  priceBtc: number;
  status: string;
  createdAt: string;
};

type Trade = {
  id: string;
  listingId: string;
  buyer: string;
  seller: string;
  tokenSymbol: string;
  quantity: number;
  totalBtc: number;
  status: string;
  createdAt: string;
};

type EngineSyncResult = {
  ok: boolean;
  error?: string;
};

export default function MarketplacePage() {
  const { isSpanish } = useLocale();
  const [listings, setListings] = useState<Listing[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastEngineSync, setLastEngineSync] = useState<EngineSyncResult | null>(null);

  async function reload() {
    try {
      const [lRes, tRes] = await Promise.all([
        fetch("/api/marketplace/listings", { cache: "no-store" }),
        fetch("/api/marketplace/trades", { cache: "no-store" })
      ]);
      const lJson = (await lRes.json()) as { listings?: Listing[]; error?: string };
      const tJson = (await tRes.json()) as { trades?: Trade[]; error?: string };
      if (!lRes.ok) throw new Error(lJson.error || `Listings HTTP ${lRes.status}`);
      if (!tRes.ok) throw new Error(tJson.error || `Trades HTTP ${tRes.status}`);
      setListings(lJson.listings ?? []);
      setTrades(tJson.trades ?? []);
      setMsg("");
    } catch (error) {
      setMsg(String(error));
    }
  }

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 7000);
    return () => clearInterval(t);
  }, []);

  async function onCreateListing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seller: String(fd.get("seller") ?? "").trim(),
          tokenSymbol: String(fd.get("tokenSymbol") ?? "").trim(),
          quantity: Number(fd.get("quantity") ?? 0),
          priceBtc: Number(fd.get("priceBtc") ?? 0)
        })
      });
      const json = (await res.json()) as { error?: string; engineSync?: EngineSyncResult };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      form.reset();
      if (json.engineSync) setLastEngineSync(json.engineSync);
      setMsg(isSpanish ? "Listing creado." : "Listing created.");
      await reload();
    } catch (error) {
      setMsg(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateTrade(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/marketplace/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId: String(fd.get("listingId") ?? "").trim(),
          buyer: String(fd.get("buyer") ?? "").trim(),
          quantity: Number(fd.get("quantity") ?? 0)
        })
      });
      const json = (await res.json()) as { error?: string; engineSync?: EngineSyncResult };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      form.reset();
      if (json.engineSync) setLastEngineSync(json.engineSync);
      setMsg(isSpanish ? "Trade creado." : "Trade created.");
      await reload();
    } catch (error) {
      setMsg(String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <Navbar title="Marketplace" />
      <ModuleGuide
        whatThisDoes="This module powers direct token marketplace activity: listings, matching trades, and settlement-ready records."
        whatToTry="Create one listing, execute a partial or full trade, and confirm quantity/status updates in real time."
        walletHint='For internal tests, use desk/user identifiers. External clients consume the same flow via public marketplace integration APIs.'
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-[#101523] p-4">
          <p className="text-xs text-slate-400">{isSpanish ? "Listings abiertos" : "Open listings"}</p>
          <p className="text-2xl font-semibold text-slate-100">
            {listings.filter((x) => x.status === "open").length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#101523] p-4">
          <p className="text-xs text-slate-400">{isSpanish ? "Trades totales" : "Total trades"}</p>
          <p className="text-2xl font-semibold text-slate-100">{trades.length}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#101523] p-4">
          <p className="text-xs text-slate-400">Volume BTC</p>
          <p className="text-2xl font-semibold text-slate-100">
            {trades.reduce((sum, t) => sum + Number(t.totalBtc || 0), 0).toFixed(8)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#101523] p-4">
        <p className="text-xs text-slate-400">{isSpanish ? "Estado sync con engine" : "Engine sync status"}</p>
        <p className={`mt-1 text-sm font-medium ${lastEngineSync?.ok === false ? "text-rose-300" : "text-emerald-300"}`}>
          {lastEngineSync
            ? lastEngineSync.ok
              ? (isSpanish ? "OK - Marketplace y engine sincronizados." : "OK - Marketplace and engine are synchronized.")
              : `${isSpanish ? "WARN - fallo de sync:" : "WARN - sync failure:"} ${lastEngineSync.error ?? "unknown"}`
            : (isSpanish ? "Sin eventos recientes." : "No recent write events yet.")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={onCreateListing} className="space-y-2 rounded-lg border border-slate-800 bg-[#101523] p-4">
          <h3 className="font-semibold text-slate-200">{isSpanish ? "Crear listing" : "Create listing"}</h3>
          <input name="seller" required placeholder={isSpanish ? "Seller (desk/usuario) ej. desk-alpha-01" : "Seller (desk/user) e.g. desk-alpha-01"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          <input name="tokenSymbol" defaultValue="BPVP20" required placeholder="Token symbol e.g. BPVP20" className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          <input name="quantity" type="number" min={0} step="any" required placeholder={isSpanish ? "Cantidad ej. 1250.50" : "Quantity e.g. 1250.50"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          <input name="priceBtc" type="number" min={0} step="any" required placeholder={isSpanish ? "Precio BTC ej. 0.00001550" : "BTC price e.g. 0.00001550"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          <button disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
            {isSpanish ? "Crear listing" : "Create listing"}
          </button>
        </form>

        <form onSubmit={onCreateTrade} className="space-y-2 rounded-lg border border-slate-800 bg-[#101523] p-4">
          <h3 className="font-semibold text-slate-200">{isSpanish ? "Ejecutar trade" : "Execute trade"}</h3>
          <input name="listingId" required placeholder="Listing ID e.g. lst_01HZX9P7Q1A2BC3D4E" className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          <input name="buyer" required placeholder={isSpanish ? "Buyer (desk/usuario) ej. desk-beta-02" : "Buyer (desk/user) e.g. desk-beta-02"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          <input name="quantity" type="number" min={0} step="any" required placeholder={isSpanish ? "Cantidad ej. 50" : "Quantity e.g. 50"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          <button disabled={busy} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            {isSpanish ? "Crear trade" : "Create trade"}
          </button>
        </form>
      </div>

      {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}

      <div className="rounded-lg border border-slate-800 bg-[#101523] p-4">
        <h3 className="mb-2 font-semibold text-slate-200">{isSpanish ? "Listings" : "Listings"}</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-2">ID</th>
                <th className="pb-2">{isSpanish ? "Seller" : "Seller"}</th>
                <th className="pb-2">Token</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Price BTC</th>
                <th className="pb-2">{isSpanish ? "Estado" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t border-slate-800 text-slate-200">
                  <td className="py-2">{l.id}</td>
                  <td className="py-2">{l.seller}</td>
                  <td className="py-2">{l.tokenSymbol}</td>
                  <td className="py-2">{l.quantity}</td>
                  <td className="py-2">{l.priceBtc}</td>
                  <td className="py-2">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-[#101523] p-4">
        <h3 className="mb-2 font-semibold text-slate-200">{isSpanish ? "Trades" : "Trades"}</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-2">ID</th>
                <th className="pb-2">Listing</th>
                <th className="pb-2">Buyer</th>
                <th className="pb-2">Seller</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Total BTC</th>
                <th className="pb-2">{isSpanish ? "Estado" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-slate-800 text-slate-200">
                  <td className="py-2">{t.id}</td>
                  <td className="py-2">{t.listingId}</td>
                  <td className="py-2">{t.buyer}</td>
                  <td className="py-2">{t.seller}</td>
                  <td className="py-2">{t.quantity}</td>
                  <td className="py-2">{t.totalBtc}</td>
                  <td className="py-2">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
