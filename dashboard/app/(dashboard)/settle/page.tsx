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

type Settlement = { id: string; status: string };

type SettleState = {
  liquidations?: string[];
  payments?: string[];
  records?: Settlement[];
};

export default function Page() {
  const { isSpanish } = useLocale();
  const { data, error, loading, refresh } = useEngineModuleState<SettleState>("settle");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const records = data?.records ?? [];

  async function onPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "settle",
        type: "payment_settled",
        data: { id: String(fd.get("id") ?? "") }
      });
      setMsg(isSpanish ? "Liquidacion de pago registrada." : "Payment settlement recorded.");
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onLiquidation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "settle",
        type: "liquidation_settled",
        data: { id: String(fd.get("id") ?? "") }
      });
      setMsg(isSpanish ? "Liquidacion registrada." : "Liquidation settlement recorded.");
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
      <Navbar title="Settle" />
      <ModuleGuide
        whatThisDoes="This module records payment and liquidation settlement confirmations in the engine ledger."
        whatToTry="Submit sample settlement IDs for payment and liquidation and verify they appear in records and raw tails."
        walletHint='Wallet link is optional. Use "Profile" if your test scenario requires attaching a wallet address to session.'
      />
      <p className="text-sm text-bpvp-muted">
        {isSpanish
          ? "Ledger de liquidacion en engine: identificadores de pago y liquidacion confirmados como finales."
          : "Settlement ledger in the engine: payment and liquidation identifiers you confirm as final. Connect this to custodian / chain confirmation feeds in production."}
      </p>

      <Card title="Settlement records">
        {loading ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Cargando…" : "Loading…"}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Aun no hay registros." : "No records yet."}</p>
        ) : (
          <Table
            headers={["Id", "Status"]}
            rows={records.slice(-50).map((r) => [
              <span key={r.id} className="font-mono text-xs">
                {r.id}
              </span>,
              <span key={r.status}>{r.status}</span>
            ])}
          />
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Record payment settled">
          <form className="space-y-3 text-sm" onSubmit={onPayment}>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "ID de liquidacion" : "Settlement id"}</span>
              <input name="id" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Aplicar" : "Apply"}
            </Button>
          </form>
        </Card>
        <Card title="Record liquidation settled">
          <form className="space-y-3 text-sm" onSubmit={onLiquidation}>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "ID de liquidacion" : "Settlement id"}</span>
              <input name="id" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Aplicar" : "Apply"}
            </Button>
          </form>
        </Card>
      </div>

      <Card title="Raw tails (engine)">
        <div className="grid gap-2 text-xs text-bpvp-faint md:grid-cols-2">
          <div>
            <div className="mb-1 text-bpvp-muted">{isSpanish ? "IDs de tx de pagos" : "Payments tx ids"}</div>
            <ul className="max-h-32 overflow-auto">
              {(data?.payments ?? []).slice(-12).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-bpvp-muted">{isSpanish ? "Liquidaciones" : "Liquidations"}</div>
            <ul className="max-h-32 overflow-auto">
              {(data?.liquidations ?? []).slice(-12).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="rounded-md border border-bpvp-border bg-bpvp-hover p-3 text-sm text-bpvp-ink">{msg}</p> : null}
    </section>
  );
}
