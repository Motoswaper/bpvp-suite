"use client";

import { FormEvent, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { postEngineAction } from "@/lib/postEngineAction";
import { useEngineModuleState } from "@/lib/useEngineModuleState";
import { useLocale } from "@/lib/useLocale";

type NFT = {
  tokenId: string;
  owner: string;
  metadata?: Record<string, string>;
  history?: string[];
};

type Bpvp721State = {
  assets?: Record<string, NFT>;
  bridgeJobs?: { id: number; tokenId: string; status: string; type: string }[];
};

export default function Page() {
  const { isSpanish } = useLocale();
  const { data, error, loading, refresh } = useEngineModuleState<Bpvp721State>("bpvp721");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const assets = useMemo(() => Object.values(data?.assets ?? {}), [data]);

  async function onMint(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "bpvp721",
        type: "mint",
        data: { tokenId: String(fd.get("tokenId") ?? "") }
      });
      setMsg("Mint applied.");
      e.currentTarget.reset();
      await refresh();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onTransfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "bpvp721",
        type: "transfer",
        data: {
          tokenId: String(fd.get("tokenId") ?? ""),
          to: String(fd.get("to") ?? "")
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

  async function onMetadata(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await postEngineAction({
        module: "bpvp721",
        type: "metadata_update",
        data: {
          tokenId: String(fd.get("tokenId") ?? ""),
          key: String(fd.get("key") ?? ""),
          value: String(fd.get("value") ?? "")
        }
      });
      setMsg("Metadata updated.");
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
      <Navbar title="BPVP721" />
      <ModuleGuide
        whatThisDoes="This module manages BPVP721 assets in-engine: mint, transfer, and metadata updates."
        whatToTry="Mint one NFT, transfer it to another test account, and update one metadata key to confirm state transitions."
        walletHint='Wallet linking can be used for identity context, but core BPVP721 test actions work with test account strings.'
      />
      <p className="text-sm text-bpvp-muted">
        {isSpanish
          ? "Inventario BPVP721 nativo en el engine. Las acciones se firman server-side y se aplican al mismo estado respaldado por journal que siguen indexer y watcher."
          : "Native BPVP721 inventory in the engine. Actions are signed server-side and applied to the same journal-backed state the indexer and watcher target."}
      </p>

      <Card title="Assets">
        {loading ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Cargando…" : "Loading…"}</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-bpvp-muted">{isSpanish ? "Aun no hay NFTs. Haz mint abajo." : "No NFTs yet. Mint one below."}</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {assets.map((a) => (
              <li key={a.tokenId} className="rounded-lg border border-bpvp-border bg-bpvp-card/50 p-3">
                <div className="font-mono text-xs text-bpvp-ink">{a.tokenId}</div>
                <div className="text-bpvp-muted">{isSpanish ? "Propietario" : "Owner"}: {a.owner}</div>
                <div className="mt-1 text-xs text-bpvp-faint">
                  {isSpanish ? "Metadatos" : "Metadata"}: {JSON.stringify(a.metadata ?? {})}
                </div>
                <div className="text-xs text-bpvp-faint">{isSpanish ? "Historial" : "History"}: {(a.history ?? []).join(" → ")}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Mint">
          <form className="space-y-3 text-sm" onSubmit={onMint}>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Token id" : "Token id"}</span>
              <input name="tokenId" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Mint" : "Mint"}
            </Button>
          </form>
        </Card>
        <Card title="Transfer">
          <form className="space-y-3 text-sm" onSubmit={onTransfer}>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Token id" : "Token id"}</span>
              <input name="tokenId" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Hacia" : "To"}</span>
              <input name="to" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Transferir" : "Transfer"}
            </Button>
          </form>
        </Card>
        <Card title="Metadata">
          <form className="space-y-3 text-sm" onSubmit={onMetadata}>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Token id" : "Token id"}</span>
              <input name="tokenId" required className="w-full bpvp-field font-mono text-xs" />
            </label>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Clave" : "Key"}</span>
              <input name="key" required className="w-full bpvp-field" />
            </label>
            <label className="block space-y-1">
              <span className="text-bpvp-muted">{isSpanish ? "Valor" : "Value"}</span>
              <input name="value" required className="w-full bpvp-field" />
            </label>
            <Button type="submit" disabled={busy}>
              {isSpanish ? "Actualizar" : "Update"}
            </Button>
          </form>
        </Card>
      </div>

      {data?.bridgeJobs && data.bridgeJobs.length > 0 ? (
        <Card title={isSpanish ? "Jobs de bridge (cuando bridge esta habilitado)" : "Bridge jobs (when bridge enabled upstream)"}>
          <ul className="text-xs text-bpvp-muted">
            {data.bridgeJobs.slice(-12).map((j) => (
              <li key={j.id}>
                #{j.id} {j.tokenId} — {j.type} — {j.status}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p> : null}
      {msg ? <p className="rounded-md border border-bpvp-border bg-bpvp-hover p-3 text-sm text-bpvp-ink">{msg}</p> : null}
    </section>
  );
}
