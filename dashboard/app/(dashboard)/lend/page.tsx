"use client";

import { FormEvent, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { postEngineAction } from "@/lib/postEngineAction";
import { useEngineModuleState } from "@/lib/useEngineModuleState";
import { useLocale } from "@/lib/useLocale";

type Position = { user: string; collateral: number; debt: number; apy: number };

type LendState = {
  pools?: Record<string, number>;
  apy?: Record<string, number>;
  positions?: Position[];
};

export default function Page() {
  const { isSpanish } = useLocale();
  const { data, error, loading, refresh } = useEngineModuleState<LendState>("lend");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const positions = data?.positions ?? [];
  const poolRows = Object.entries(data?.pools ?? {}).map(([k, v]) => [k, String(v), String(data?.apy?.[k] ?? "—")] as [string, string, string]);

  async function onBorrow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "lend",
        type: "borrow",
        data: {
          user: String(fd.get("user") ?? ""),
          collateral: Number(fd.get("collateral")),
          debt: Number(fd.get("debt"))
        }
      });
      setMsg(isSpanish ? "Posicion de prestamo registrada." : "Borrow position recorded.");
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <Navbar title="Lend" />
      <ModuleGuide
        whatThisDoes="This module tracks lending pools, APY snapshots, and simulated borrow positions."
        whatToTry="Create one or more borrow positions and confirm pool/position values and APY views update as expected."
        walletHint='Wallet linking is not mandatory for lend simulation tests; use "Profile" only if you need wallet-attached sessions.'
      />
      <p className="text-sm text-slate-400">
        {isSpanish
          ? "Liquidez de pools y posiciones de prestamo de desk en simulacion de engine."
          : "Pool liquidity and desk borrow positions in the engine simulation. This backs desk stress and collateral views; wire real lending policies in the risk layer as you harden for production."}
      </p>

      <Card title="Pools">
        {loading ? (
          <p className="text-sm text-slate-400">{isSpanish ? "Cargando…" : "Loading…"}</p>
        ) : poolRows.length === 0 ? (
          <p className="text-sm text-slate-400">{isSpanish ? "Sin filas de pools." : "No pool rows."}</p>
        ) : (
          <Table
            headers={["Pool", "Liquidity", "APY %"]}
            rows={poolRows.map(([a, b, c]) => [<span key={a}>{a}</span>, <span key={b}>{b}</span>, <span key={c}>{c}</span>])}
          />
        )}
      </Card>

      <Card title="Open positions">
        {positions.length === 0 ? (
          <p className="text-sm text-slate-400">{isSpanish ? "Aun no hay posiciones." : "No positions yet."}</p>
        ) : (
          <Table
            headers={["User", "Collateral", "Debt", "APY %"]}
            rows={positions.map((p, i) => [
              <span key={`u${i}`} className="font-mono text-xs">
                {p.user}
              </span>,
              <span key={`c${i}`}>{p.collateral}</span>,
              <span key={`d${i}`}>{p.debt}</span>,
              <span key={`a${i}`}>{p.apy}</span>
            ])}
          />
        )}
      </Card>

      <Card title="Simulate borrow (engine action)">
        <form className="grid gap-3 text-sm md:grid-cols-4 md:items-end" onSubmit={onBorrow}>
          <label className="block space-y-1 md:col-span-2">
              <span className="text-slate-400">{isSpanish ? "Usuario / desk" : "User / desk"}</span>
            <input name="user" required className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs" />
          </label>
          <label className="block space-y-1">
              <span className="text-slate-400">{isSpanish ? "Colateral" : "Collateral"}</span>
            <input name="collateral" type="number" step="any" min={0} required className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          </label>
          <label className="block space-y-1">
              <span className="text-slate-400">{isSpanish ? "Deuda" : "Debt"}</span>
            <input name="debt" type="number" step="any" min={0} required className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          </label>
          <div className="md:col-span-4">
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Agregar posicion" : "Append position"}
            </Button>
          </div>
        </form>
      </Card>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">{msg}</p> : null}
    </section>
  );
}
