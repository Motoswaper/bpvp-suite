"use client";

import { FormEvent, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { postEngineAction } from "@/lib/postEngineAction";
import { useEngineModuleState } from "@/lib/useEngineModuleState";
import { useLocale } from "@/lib/useLocale";

type RFQ = {
  id: string;
  pair: string;
  side: "buy" | "sell";
  quantity: number;
  requester: string;
  limitPrice?: number;
  status: string;
  createdAt: number;
  expiresAt?: number;
  notes?: string;
};

type Quote = {
  id: string;
  rfqId: string;
  maker: string;
  price: number;
  quantity: number;
  status: string;
  createdAt: number;
  validUntil?: number;
};

type Trade = {
  id: string;
  rfqId: string;
  quoteId: string;
  buyer: string;
  seller: string;
  pair: string;
  price: number;
  quantity: number;
  notional: number;
  status: string;
  createdAt: number;
  settledAt?: number;
  settleRef?: string;
};

type OTCState = {
  rfqs?: RFQ[];
  quotes?: Quote[];
  trades?: Trade[];
  openRfqs?: Record<string, RFQ>;
  openTrades?: Record<string, Trade>;
  history?: string[];
};

const fmtTs = (ts?: number) => (ts ? new Date(ts * 1000).toLocaleString() : "-");

export default function OTCPage() {
  const { isSpanish } = useLocale();
  const { data, error, loading, refresh } = useEngineModuleState<OTCState>("otc", 7000);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const rfqs = useMemo(() => [...(data?.rfqs ?? [])].reverse(), [data]);
  const quotes = useMemo(() => [...(data?.quotes ?? [])].reverse(), [data]);
  const trades = useMemo(() => [...(data?.trades ?? [])].reverse(), [data]);

  async function applyAction(fn: () => Promise<unknown>, success: string, resetForm?: HTMLFormElement) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      if (resetForm) resetForm.reset();
      setMsg(success);
      await refresh();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onCreateRFQ(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void applyAction(
      () =>
        postEngineAction({
          module: "otc",
          type: "rfq_create",
          data: {
            rfqId: String(fd.get("rfqId") ?? "").trim() || undefined,
            pair: String(fd.get("pair") ?? "").trim(),
            side: String(fd.get("side") ?? "").trim(),
            quantity: Number(fd.get("quantity")),
            requester: String(fd.get("requester") ?? "").trim(),
            limitPrice: fd.get("limitPrice") ? Number(fd.get("limitPrice")) : undefined,
            expiresAt: fd.get("expiresAt") ? Number(fd.get("expiresAt")) : undefined,
            notes: String(fd.get("notes") ?? "").trim() || undefined
          }
        }),
      isSpanish ? "RFQ creado." : "RFQ created.",
      form
    );
  }

  function onSubmitQuote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void applyAction(
      () =>
        postEngineAction({
          module: "otc",
          type: "quote_submit",
          data: {
            quoteId: String(fd.get("quoteId") ?? "").trim() || undefined,
            rfqId: String(fd.get("rfqId") ?? "").trim(),
            maker: String(fd.get("maker") ?? "").trim(),
            price: Number(fd.get("price")),
            quantity: Number(fd.get("quantity")),
            validUntil: fd.get("validUntil") ? Number(fd.get("validUntil")) : undefined
          }
        }),
      isSpanish ? "Cotizacion enviada." : "Quote submitted.",
      form
    );
  }

  function onAcceptQuote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void applyAction(
      () =>
        postEngineAction({
          module: "otc",
          type: "quote_accept",
          data: {
            tradeId: String(fd.get("tradeId") ?? "").trim() || undefined,
            rfqId: String(fd.get("rfqId") ?? "").trim(),
            quoteId: String(fd.get("quoteId") ?? "").trim(),
            taker: String(fd.get("taker") ?? "").trim()
          }
        }),
      isSpanish ? "Cotizacion aceptada y trade creado." : "Quote accepted and trade created.",
      form
    );
  }

  function onSettleTrade(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    void applyAction(
      () =>
        postEngineAction({
          module: "otc",
          type: "trade_settle",
          data: {
            tradeId: String(fd.get("tradeId") ?? "").trim(),
            settleRef: String(fd.get("settleRef") ?? "").trim()
          }
        }),
      isSpanish ? "Trade liquidado." : "Trade settled.",
      form
    );
  }

  return (
    <section className="space-y-4">
      <Navbar title="OTC" />
      <ModuleGuide
        whatThisDoes="This module simulates an OTC lifecycle: RFQ creation, quote submission, acceptance, and settlement."
        whatToTry="Create one RFQ, submit at least one quote, accept a quote into a trade, then settle that trade."
        walletHint='Use desk/test identities in forms. Wallet linking is available in "Profile" and not required for basic OTC tests.'
      />
      <p className="text-sm text-bpvp-muted">
        {isSpanish
          ? "Flujo OTC en engine: creacion de RFQ, envio de cotizacion del maker, aceptacion del taker y liquidacion explicita."
          : "OTC desk workflow in-engine: RFQ creation, maker quote submission, taker quote acceptance, and explicit settlement marking."}
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Open RFQs">
          <p className="text-2xl font-semibold text-bpvp-ink">{Object.keys(data?.openRfqs ?? {}).length}</p>
        </Card>
        <Card title="Open trades">
          <p className="text-2xl font-semibold text-bpvp-ink">{Object.keys(data?.openTrades ?? {}).length}</p>
        </Card>
        <Card title="Quotes total">
          <p className="text-2xl font-semibold text-bpvp-ink">{(data?.quotes ?? []).length}</p>
        </Card>
        <Card title="Trades total">
          <p className="text-2xl font-semibold text-bpvp-ink">{(data?.trades ?? []).length}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Create RFQ">
          <form className="grid gap-2 text-sm" onSubmit={onCreateRFQ}>
            <input name="rfqId" placeholder="RFQ ID (optional) e.g. rfq_20260429_001" className="bpvp-field" />
            <input name="pair" placeholder={isSpanish ? "Par (ej. BTC/USD)" : "Pair (e.g. BTC/USD)"} required className="bpvp-field" />
            <select name="side" className="bpvp-field">
              <option value="buy">{isSpanish ? "compra" : "buy"}</option>
              <option value="sell">{isSpanish ? "venta" : "sell"}</option>
            </select>
            <input name="quantity" type="number" min={0} step="any" required placeholder={isSpanish ? "Cantidad ej. 2.5" : "Quantity e.g. 2.5"} className="bpvp-field" />
            <input name="requester" required placeholder={isSpanish ? "Solicitante desk/usuario ej. desk-latam-01" : "Requester desk/user e.g. desk-latam-01"} className="bpvp-field" />
            <input name="limitPrice" type="number" min={0} step="any" placeholder={isSpanish ? "Precio limite (opcional) ej. 64500" : "Limit price (optional) e.g. 64500"} className="bpvp-field" />
            <input name="expiresAt" type="number" min={0} step="1" placeholder={isSpanish ? "Expira Unix (opcional) ej. 1767225600" : "ExpiresAt Unix (optional) e.g. 1767225600"} className="bpvp-field" />
            <input name="notes" placeholder={isSpanish ? "Notas (opcional) ej. ventana NYC AM" : "Notes (optional) e.g. NYC AM window"} className="bpvp-field" />
            <Button type="submit" disabled={busy}>{isSpanish ? "Crear RFQ" : "Create RFQ"}</Button>
          </form>
        </Card>

        <Card title="Submit quote">
          <form className="grid gap-2 text-sm" onSubmit={onSubmitQuote}>
            <input name="quoteId" placeholder={isSpanish ? "ID Cotizacion (opcional) ej. qte_20260429_001" : "Quote ID (optional) e.g. qte_20260429_001"} className="bpvp-field" />
            <input name="rfqId" required placeholder="RFQ ID e.g. rfq_20260429_001" className="bpvp-field" />
            <input name="maker" required placeholder={isSpanish ? "Maker desk/usuario ej. mm-desk-01" : "Maker desk/user e.g. mm-desk-01"} className="bpvp-field" />
            <input name="price" type="number" min={0} step="any" required placeholder={isSpanish ? "Precio ej. 64320.5" : "Price e.g. 64320.5"} className="bpvp-field" />
            <input name="quantity" type="number" min={0} step="any" required placeholder={isSpanish ? "Cantidad ej. 1.25" : "Quantity e.g. 1.25"} className="bpvp-field" />
            <input name="validUntil" type="number" min={0} step="1" placeholder={isSpanish ? "Valida hasta Unix (opcional) ej. 1767225600" : "ValidUntil Unix (optional) e.g. 1767225600"} className="bpvp-field" />
            <Button type="submit" disabled={busy}>{isSpanish ? "Enviar cotizacion" : "Submit quote"}</Button>
          </form>
        </Card>

        <Card title="Accept quote (create trade)">
          <form className="grid gap-2 text-sm" onSubmit={onAcceptQuote}>
            <input name="tradeId" placeholder={isSpanish ? "ID Trade (opcional) ej. trd_20260429_001" : "Trade ID (optional) e.g. trd_20260429_001"} className="bpvp-field" />
            <input name="rfqId" required placeholder="RFQ ID e.g. rfq_20260429_001" className="bpvp-field" />
            <input name="quoteId" required placeholder="Quote ID e.g. qte_20260429_001" className="bpvp-field" />
            <input name="taker" required placeholder={isSpanish ? "Taker desk/usuario ej. buy-desk-03" : "Taker desk/user e.g. buy-desk-03"} className="bpvp-field" />
            <Button type="submit" disabled={busy}>{isSpanish ? "Aceptar cotizacion" : "Accept quote"}</Button>
          </form>
        </Card>

        <Card title="Settle trade">
          <form className="grid gap-2 text-sm" onSubmit={onSettleTrade}>
            <input name="tradeId" required placeholder={isSpanish ? "ID Trade ej. trd_20260429_001" : "Trade ID e.g. trd_20260429_001"} className="bpvp-field" />
            <input name="settleRef" required placeholder={isSpanish ? "Referencia liquidacion / txid ej. b3f1a9...c72e" : "Settlement reference / txid e.g. b3f1a9...c72e"} className="bpvp-field" />
            <Button type="submit" disabled={busy}>{isSpanish ? "Liquidar trade" : "Settle trade"}</Button>
          </form>
        </Card>
      </div>

      <Card title="RFQs">
        {loading ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Cargando..." : "Loading..."}</p>
        ) : rfqs.length === 0 ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Aun no hay RFQs." : "No RFQs yet."}</p>
        ) : (
          <Table
            headers={isSpanish ? ["ID", "Par", "Lado", "Cant", "Solicitante", "Estado", "Creado"] : ["ID", "Pair", "Side", "Qty", "Requester", "Status", "Created"]}
            rows={rfqs.slice(0, 25).map((r) => [
              <span key={`id-${r.id}`} className="font-mono text-xs">{r.id}</span>,
              r.pair,
              r.side,
              String(r.quantity),
              r.requester,
              r.status,
              fmtTs(r.createdAt)
            ])}
          />
        )}
      </Card>

      <Card title="Quotes">
        {quotes.length === 0 ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Aun no hay cotizaciones." : "No quotes yet."}</p>
        ) : (
          <Table
            headers={isSpanish ? ["ID", "RFQ", "Maker", "Precio", "Cant", "Estado", "Creado"] : ["ID", "RFQ", "Maker", "Price", "Qty", "Status", "Created"]}
            rows={quotes.slice(0, 25).map((q) => [
              <span key={`qid-${q.id}`} className="font-mono text-xs">{q.id}</span>,
              q.rfqId,
              q.maker,
              String(q.price),
              String(q.quantity),
              q.status,
              fmtTs(q.createdAt)
            ])}
          />
        )}
      </Card>

      <Card title="Trades">
        {trades.length === 0 ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Aun no hay trades." : "No trades yet."}</p>
        ) : (
          <Table
            headers={isSpanish ? ["ID", "Par", "Comprador", "Vendedor", "Precio", "Cant", "Estado", "Ref liquidacion"] : ["ID", "Pair", "Buyer", "Seller", "Price", "Qty", "Status", "Settle ref"]}
            rows={trades.slice(0, 25).map((t) => [
              <span key={`tid-${t.id}`} className="font-mono text-xs">{t.id}</span>,
              t.pair,
              t.buyer,
              t.seller,
              String(t.price),
              String(t.quantity),
              t.status,
              t.settleRef ?? "-"
            ])}
          />
        )}
      </Card>

      <Card title="History tail">
        <ul className="max-h-40 overflow-auto text-xs text-bpvp-faint">
          {(data?.history ?? []).slice(-40).map((h, i) => (
            <li key={`${i}-${h}`}>{h}</li>
          ))}
        </ul>
      </Card>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="rounded-md border border-bpvp-border bg-bpvp-hover p-3 text-sm text-bpvp-ink">{msg}</p> : null}
    </section>
  );
}
