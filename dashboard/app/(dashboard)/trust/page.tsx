"use client";

import { FormEvent, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { postEngineAction } from "@/lib/postEngineAction";
import { useEngineModuleState } from "@/lib/useEngineModuleState";
import { useLocale } from "@/lib/useLocale";

type TrustState = {
  scores?: Record<string, number>;
  ratings?: Record<string, string>;
  history?: string[];
};

export default function Page() {
  const { isSpanish } = useLocale();
  const { data, error, loading, refresh } = useEngineModuleState<TrustState>("trust");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const scoreRows = Object.entries(data?.scores ?? {}).sort(([a], [b]) => a.localeCompare(b));

  async function onScore(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "trust",
        type: "score_update",
        data: {
          subject: String(fd.get("subject") ?? ""),
          score: Number(fd.get("score")),
          rating: String(fd.get("rating") ?? "")
        }
      });
      setMsg(isSpanish ? "Senal de confianza registrada." : "Trust signal recorded.");
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
      <Navbar title="Trust" />
      <ModuleGuide
        whatThisDoes="This module stores and displays trust scores/ratings for desks or counterparties."
        whatToTry="Add a few score updates with different ratings and verify they appear correctly in the score list and history."
        walletHint='Wallet linking is optional and available in "Profile" if your testing flow needs wallet identity.'
      />
      <p className="text-sm text-slate-400">
        {isSpanish
          ? "Senales de confianza de contraparte y desk almacenadas en engine (puntajes 0-100 y rating cualitativo)."
          : "Counterparty and desk trust signals stored in-engine (scores 0–100, qualitative rating). Data feeds dashboards and risk workflows; align on-chain attestations separately via the protocol indexer when enabled."}
      </p>

      <Card title="Scores">
        {loading ? (
          <p className="text-sm text-slate-400">{isSpanish ? "Cargando…" : "Loading…"}</p>
        ) : scoreRows.length === 0 ? (
          <p className="text-sm text-slate-400">{isSpanish ? "Aun no hay puntajes." : "No scores yet."}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {scoreRows.map(([k, v]) => (
              <li key={k}>
                <span className="font-mono text-xs text-slate-200">{k}</span>
                <span className="text-slate-500"> — </span>
                {v}
                <span className="text-slate-500"> ({data?.ratings?.[k] ?? "—"})</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="History tail">
        <ul className="max-h-40 overflow-auto text-xs text-slate-500">
          {(data?.history ?? []).slice(-40).map((h, i) => (
            <li key={`${i}-${h}`}>{h}</li>
          ))}
        </ul>
      </Card>

      <Card title="Record score update">
        <form className="grid gap-3 text-sm md:grid-cols-4 md:items-end" onSubmit={onScore}>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-slate-400">{isSpanish ? "Sujeto (desk / id entidad)" : "Subject (desk / entity id)"}</span>
            <input name="subject" required placeholder={isSpanish ? "ej. desk-latam-01" : "e.g. desk-latam-01"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs" />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">{isSpanish ? "Puntaje (0-100)" : "Score (0–100)"}</span>
            <input name="score" type="number" min={0} max={100} step="0.1" required placeholder={isSpanish ? "ej. 82.5" : "e.g. 82.5"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">{isSpanish ? "Etiqueta de rating" : "Rating label"}</span>
            <input name="rating" required placeholder={isSpanish ? "ej. GREEN" : "e.g. GREEN"} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" />
          </label>
          <div className="md:col-span-4">
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Aplicar" : "Apply"}
            </Button>
          </div>
        </form>
      </Card>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">{msg}</p> : null}
    </section>
  );
}
