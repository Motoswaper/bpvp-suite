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

type Bpvp20State = {
  balances?: Record<string, number>;
  supply?: number;
  metadata?: Record<string, string>;
};

export default function Page() {
  const { isSpanish } = useLocale();
  const { data, error, loading, refresh } = useEngineModuleState<Bpvp20State>("bpvp20");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const balances = data?.balances ?? {};
  const rows = Object.entries(balances)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([addr, bal]) => [addr, String(bal)] as [string, string]);

  async function onTransfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "bpvp20",
        type: "transfer",
        data: {
          from: String(fd.get("from") ?? ""),
          to: String(fd.get("to") ?? ""),
          amount: Number(fd.get("amount"))
        }
      });
      setMsg("Transfer applied.");
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onBurn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "bpvp20",
        type: "burn",
        data: {
          from: String(fd.get("from") ?? ""),
          amount: Number(fd.get("amount"))
        }
      });
      setMsg("Burn applied.");
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
      <Navbar title="BPVP20" />
      <ModuleGuide
        whatThisDoes="This module shows BPVP20 balances and supply, and lets you test transfer/burn actions."
        whatToTry="Run small transfers between test accounts, then validate updated balances and unchanged total supply expectations."
        walletHint='No wallet is required for basic token simulation. For identity-linked tests, connect wallet from "Profile".'
      />
      <p className="text-sm text-bpvp-muted">
        {isSpanish
          ? (
              <>
                Balances en vivo desde el modulo <code className="text-bpvp-ink">bpvp20</code> del axe-engine. Las transferencias mueven BPVP20
                entre desks; mint permanece deshabilitado salvo configuracion explicita del engine.
              </>
            )
          : (
              <>
                Live balances from the axe-engine <code className="text-bpvp-ink">bpvp20</code> module. Transfers move BPVP20 between desks; mint
                is disabled unless the engine is configured for it.
              </>
            )}
      </p>

      <Card title="Supply & metadata">
        <div className="grid gap-2 text-sm text-bpvp-ink md:grid-cols-2">
          <div>
            <span className="text-bpvp-faint">{isSpanish ? "Supply: " : "Supply: "}</span>
            {loading ? "…" : (data?.supply ?? "-").toString()}
          </div>
          <div>
            <span className="text-bpvp-faint">{isSpanish ? "Simbolo: " : "Symbol: "}</span>
            {data?.metadata?.symbol ?? "—"}
          </div>
          <div className="md:col-span-2">
            <span className="text-bpvp-faint">{isSpanish ? "Genesis / politica de mint: " : "Genesis / mint policy: "}</span>
            {(data?.metadata?.genesisStatus ?? "—") + " · " + (data?.metadata?.mintPolicy ?? "—")}
          </div>
        </div>
      </Card>

      <Card title="Balances (engine state)">
        {rows.length === 0 && !error ? (
          <p className="text-sm text-bpvp-muted">{loading ? (isSpanish ? "Cargando…" : "Loading…") : isSpanish ? "Sin balances aun." : "No balance rows yet."}</p>
        ) : (
          <Table
            headers={["Account", "Balance"]}
            rows={rows.map(([a, b]) => [
              <span key={a} className="font-mono text-xs">
                {a}
              </span>,
              <span key={b}>{b}</span>
            ])}
          />
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Transfer">
          <form className="space-y-3 text-sm" onSubmit={onTransfer}>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Desde" : "From"}</span>
              <input name="from" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Hacia" : "To"}</span>
              <input name="to" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Monto" : "Amount"}</span>
              <input name="amount" type="number" step="any" min={0} required className="w-full bpvp-field" />
            </label>
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Aplicar transferencia" : "Apply transfer"}
            </Button>
          </form>
        </Card>
        <Card title="Burn">
          <form className="space-y-3 text-sm" onSubmit={onBurn}>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Desde" : "From"}</span>
              <input name="from" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Monto" : "Amount"}</span>
              <input name="amount" type="number" step="any" min={0} required className="w-full bpvp-field" />
            </label>
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Aplicar burn" : "Apply burn"}
            </Button>
          </form>
        </Card>
      </div>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="rounded-md border border-bpvp-border bg-bpvp-hover p-3 text-sm text-bpvp-ink">{msg}</p> : null}
    </section>
  );
}
