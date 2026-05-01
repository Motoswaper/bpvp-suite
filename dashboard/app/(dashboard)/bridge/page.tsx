"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/lib/useLocale";

type BridgeJob = {
  id: number;
  type: string;
  tokenId: string;
  network: string;
  standard: string;
  contract: string;
  externalTokenId?: string;
  status: string;
  requestedBy?: string;
  approvedBy?: string;
  approvers?: string[];
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

type BridgeState = {
  assets?: Record<string, unknown>;
  bridgeJobs?: BridgeJob[];
  nextBridgeJobId?: number;
  bridgePolicy?: {
    requireDualApproval?: boolean;
    allowedNetworks?: string[];
    allowedStandards?: string[];
    allowedContracts?: string[];
  };
};

type SessionPayload = {
  ok: boolean;
  session?: {
    role?: string;
  };
};

export default function BridgePage() {
  const { isSpanish } = useLocale();
  const [state, setState] = useState<BridgeState>({});
  const [role, setRole] = useState<string>("viewer");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [tokenId, setTokenId] = useState("nft-001");
  const [network, setNetwork] = useState("ethereum");
  const [standard, setStandard] = useState("erc721");
  const [contract, setContract] = useState("0xContract");
  const [externalTokenId, setExternalTokenId] = useState("1001");
  const [jobId, setJobId] = useState("");
  const [approver, setApprover] = useState("ops-admin-1");
  const [txHash, setTxHash] = useState("");
  const [bridgeError, setBridgeError] = useState("");
  const [requireDualApproval, setRequireDualApproval] = useState(true);
  const [allowedNetworks, setAllowedNetworks] = useState("ethereum,solana,bitcoin-l2");
  const [allowedStandards, setAllowedStandards] = useState("erc721,mpl-core,bpvp721-external");
  const [allowedContracts, setAllowedContracts] = useState("");

  async function refresh() {
    const res = await fetch("/api/bridge/state", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "failed to fetch bridge state");
    }
    setState((data?.state ?? data ?? {}) as BridgeState);
  }

  async function runAction(type: string, data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bridge/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "action failed");
      setMessage(isSpanish ? `Accion aplicada: ${type}` : `Action applied: ${type}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    void (async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as SessionPayload;
      if (res.ok && payload?.ok) {
        setRole(String(payload.session?.role ?? "viewer"));
      }
    })();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, []);

  const jobs = Array.isArray(state.bridgeJobs) ? state.bridgeJobs : [];
  const policy = state.bridgePolicy ?? {};
  const isAdmin = role === "admin";

  return (
    <section className="space-y-4">
      <Navbar title="Bridge Controller" />
      <ModuleGuide
        whatThisDoes="This module manages bridge job queues and approvals between BPVP assets and external networks."
        whatToTry="Enqueue one test job, move it through approval/submission/confirmation states, and verify it appears in the bridge queue."
        walletHint='Bridge forms are operator-style simulation tools. Wallet linking is optional and can be done in "Profile".'
      />
      {isAdmin ? (
        <>
          <Card title={isSpanish ? "Encolar Jobs de Bridge (admin)" : "Enqueue Bridge Jobs (admin)"}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="tokenId e.g. nft-001" className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder={isSpanish ? "red ej. ethereum" : "network e.g. ethereum"} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input value={standard} onChange={(e) => setStandard(e.target.value)} placeholder={isSpanish ? "estandar ej. erc721" : "standard e.g. erc721"} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input value={contract} onChange={(e) => setContract(e.target.value)} placeholder="contract e.g. 0xAbC123...7890" className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
              <input value={externalTokenId} onChange={(e) => setExternalTokenId(e.target.value)} placeholder="externalTokenId e.g. 1001" className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void runAction("bridge_enqueue_mint", { tokenId, network, standard, contract, externalTokenId })} className="rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600 disabled:opacity-50">{isSpanish ? "Encolar Mint" : "Enqueue Mint"}</button>
              <button disabled={busy} onClick={() => void runAction("bridge_enqueue_burn", { tokenId, network, standard, contract, externalTokenId })} className="rounded bg-rose-700 px-3 py-1 text-sm hover:bg-rose-600 disabled:opacity-50">{isSpanish ? "Encolar Burn" : "Enqueue Burn"}</button>
              <button disabled={busy} onClick={() => void runAction("bridge_enqueue_sync", { tokenId, network, standard, contract, externalTokenId })} className="rounded bg-indigo-700 px-3 py-1 text-sm hover:bg-indigo-600 disabled:opacity-50">{isSpanish ? "Encolar Sync" : "Enqueue Sync"}</button>
            </div>
          </Card>

          <Card title="Bridge Policy (Admin)">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={requireDualApproval} onChange={(e) => setRequireDualApproval(e.target.checked)} />
            {isSpanish ? "Requiere doble aprobacion (4-ojos)" : "Require dual approval (4-eyes)"}
          </label>
          <input value={allowedNetworks} onChange={(e) => setAllowedNetworks(e.target.value)} placeholder={isSpanish ? "redes permitidas (coma) ej. ethereum,solana" : "allowed networks (comma) e.g. ethereum,solana"} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
          <input value={allowedStandards} onChange={(e) => setAllowedStandards(e.target.value)} placeholder={isSpanish ? "estandares (coma) ej. erc721,mpl-core" : "allowed standards (comma) e.g. erc721,mpl-core"} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
          <input value={allowedContracts} onChange={(e) => setAllowedContracts(e.target.value)} placeholder={isSpanish ? "contratos (coma, opcional) ej. 0xA...,0xB..." : "allowed contracts (comma, optional) e.g. 0xA...,0xB..."} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            disabled={busy}
            onClick={() =>
              void runAction("bridge_set_policy", {
                requireDualApproval,
                allowedNetworks: allowedNetworks.split(",").map((v) => v.trim()).filter(Boolean),
                allowedStandards: allowedStandards.split(",").map((v) => v.trim()).filter(Boolean),
                allowedContracts: allowedContracts.split(",").map((v) => v.trim()).filter(Boolean)
              })
            }
            className="rounded bg-amber-700 px-3 py-1 text-sm hover:bg-amber-600 disabled:opacity-50"
          >
            {isSpanish ? "Aplicar Politica" : "Apply Policy"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {isSpanish ? "Politica activa" : "Active policy"}: dualApproval={String(policy.requireDualApproval ?? false)} | networks={(policy.allowedNetworks ?? []).join(",") || "-"} | standards={(policy.allowedStandards ?? []).join(",") || "-"}
        </p>
          </Card>

          <Card title={isSpanish ? "Ciclo de Vida de Job de Bridge (admin)" : "Bridge Job Lifecycle (admin)"}>
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="jobId e.g. 12" className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
          <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder={isSpanish ? "id aprobador ej. ops-admin-1" : "approver id e.g. ops-admin-1"} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
          <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder={isSpanish ? "txHash (opcional) ej. 0xabc123...def9" : "txHash (optional) e.g. 0xabc123...def9"} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
          <input value={bridgeError} onChange={(e) => setBridgeError(e.target.value)} placeholder={isSpanish ? "texto de error ej. contract not allowed" : "error text e.g. contract not allowed"} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={busy || !jobId || !approver} onClick={() => void runAction("bridge_approve_job", { jobId: Number(jobId), approver })} className="rounded bg-amber-700 px-3 py-1 text-sm hover:bg-amber-600 disabled:opacity-50">{isSpanish ? "Aprobar" : "Approve"}</button>
          <button disabled={busy || !jobId || !txHash} onClick={() => void runAction("bridge_mark_submitted", { jobId: Number(jobId), txHash })} className="rounded bg-blue-700 px-3 py-1 text-sm hover:bg-blue-600 disabled:opacity-50">{isSpanish ? "Marcar Enviado" : "Mark Submitted"}</button>
          <button disabled={busy || !jobId} onClick={() => void runAction("bridge_mark_confirmed", { jobId: Number(jobId), txHash: txHash || undefined, externalTokenId: externalTokenId || undefined })} className="rounded bg-emerald-800 px-3 py-1 text-sm hover:bg-emerald-700 disabled:opacity-50">{isSpanish ? "Marcar Confirmado" : "Mark Confirmed"}</button>
          <button disabled={busy || !jobId} onClick={() => void runAction("bridge_mark_failed", { jobId: Number(jobId), error: bridgeError || "bridge failed" })} className="rounded bg-rose-800 px-3 py-1 text-sm hover:bg-rose-700 disabled:opacity-50">{isSpanish ? "Marcar Fallido" : "Mark Failed"}</button>
        </div>
          </Card>
        </>
      ) : (
        <Card title="Bridge Access">
          <p className="text-sm text-slate-400">
            {isSpanish
              ? "La ejecucion de bridge y controles de politica estan restringidos a administradores en este testnet."
              : "Bridge execution and policy controls are restricted to administrators in this testnet environment."}
          </p>
        </Card>
      )}

      <Card title="Bridge Queue">
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-400">{isSpanish ? "Aun no hay jobs de bridge." : "No bridge jobs yet."}</p>
        ) : (
          <div className="space-y-2">
            {jobs
              .slice()
              .reverse()
              .map((j) => (
                <div key={j.id} className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                  #{j.id} {j.type} {j.tokenId} [{j.network}/{j.standard}] {isSpanish ? "estado" : "status"}={j.status}{" "}
                  {isSpanish ? "aprobaciones" : "approvals"}={(j.approvers ?? []).join("|") || "-"} tx={j.txHash || "-"} err={j.error || "-"}
                </div>
              ))}
          </div>
        )}
        {message ? <p className="mt-2 text-xs text-emerald-400">{message}</p> : null}
        {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
      </Card>
    </section>
  );
}
