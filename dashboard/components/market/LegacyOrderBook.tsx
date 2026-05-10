"use client";

import { FormEvent, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { postEngineAction } from "@/lib/postEngineAction";
import { useEngineModuleState } from "@/lib/useEngineModuleState";

type Order = { id: string; side: string; price: number; amount: number };

type MarketState = {
  bids?: Order[];
  asks?: Order[];
  trades?: string[];
};

export function LegacyOrderBook() {
  const { data, error, loading, refresh } = useEngineModuleState<MarketState>("market", 8000);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const orderId = String(fd.get("orderId") ?? "").trim();
    if (!orderId) {
      setMsg("Order id is required (becomes engine action type for the simulated book).");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "market",
        type: orderId,
        data: {
          side: String(fd.get("side") ?? "buy"),
          price: Number(fd.get("price")),
          amount: Number(fd.get("amount"))
        }
      });
      setMsg("Order staged on simulated book.");
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  const bids = data?.bids ?? [];
  const asks = data?.asks ?? [];

  return (
    <div className="space-y-4">
      <Card title="Simulated central limit book (engine)">
        <p className="mb-3 text-sm text-bpvp-muted">
          These orders live in the same <code className="text-bpvp-ink">market</code> module as the AMM. Use a unique order id per click;
          side must be <code className="text-bpvp-ink">buy</code> or <code className="text-bpvp-ink">sell</code>.
        </p>
        {loading ? <p className="text-sm text-bpvp-muted">Loading…</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-bpvp-faint">Bids</h4>
            {bids.length === 0 ? (
              <p className="text-xs text-bpvp-faint">Empty</p>
            ) : (
              <Table
                headers={["Id", "Side", "Price", "Qty"]}
                rows={bids.slice(-12).map((o) => [
                  <span key={o.id} className="font-mono text-[10px]">
                    {o.id}
                  </span>,
                  o.side,
                  String(o.price),
                  String(o.amount)
                ])}
              />
            )}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-bpvp-faint">Asks</h4>
            {asks.length === 0 ? (
              <p className="text-xs text-bpvp-faint">Empty</p>
            ) : (
              <Table
                headers={["Id", "Side", "Price", "Qty"]}
                rows={asks.slice(-12).map((o) => [
                  <span key={o.id} className="font-mono text-[10px]">
                    {o.id}
                  </span>,
                  o.side,
                  String(o.price),
                  String(o.amount)
                ])}
              />
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-bpvp-faint">Recent trade tags: {(data?.trades ?? []).slice(-6).join(" · ") || "—"}</p>
      </Card>

      <Card title="Place simulated order">
        <form className="grid gap-3 text-sm md:grid-cols-5 md:items-end" onSubmit={onSubmit}>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-bpvp-muted">Order id (unique)</span>
            <input name="orderId" required placeholder="desk-alpha-42" className="w-full bpvp-field font-mono text-xs" />
          </label>
          <label className="block space-y-1">
            <span className="text-bpvp-muted">Side</span>
            <select name="side" className="w-full bpvp-field">
              <option value="buy">buy</option>
              <option value="sell">sell</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-bpvp-muted">Price</span>
            <input name="price" type="number" step="any" min={0} required className="w-full bpvp-field" />
          </label>
          <label className="block space-y-1">
            <span className="text-bpvp-muted">Amount</span>
            <input name="amount" type="number" step="any" min={0} required className="w-full bpvp-field" />
          </label>
          <div className="md:col-span-5">
            <Button type="submit" disabled={busy}>
              Submit to engine
            </Button>
          </div>
        </form>
      </Card>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="rounded-md border border-bpvp-border bg-bpvp-hover p-3 text-sm text-bpvp-ink">{msg}</p> : null}
    </div>
  );
}
