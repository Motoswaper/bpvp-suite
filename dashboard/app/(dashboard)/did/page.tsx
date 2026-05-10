"use client";

import { FormEvent, useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { useLocale } from "@/lib/useLocale";

type DidIdentity = {
  did: string;
  controller: string;
  walletAddress?: string;
  label?: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
};

type DidCredential = {
  id: string;
  subjectDid: string;
  issuer: string;
  type: string;
  claims: Record<string, string | number | boolean>;
  status: "active" | "revoked" | "expired";
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revocationReason?: string;
};

export default function DidPage() {
  const { isSpanish } = useLocale();
  const [identities, setIdentities] = useState<DidIdentity[]>([]);
  const [credentials, setCredentials] = useState<DidCredential[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [docPreview, setDocPreview] = useState("");

  async function reload() {
    const [iRes, cRes] = await Promise.all([
      fetch("/api/did/identities", { cache: "no-store" }),
      fetch("/api/did/credentials", { cache: "no-store" })
    ]);
    const iJson = (await iRes.json()) as { identities?: DidIdentity[]; error?: string };
    const cJson = (await cRes.json()) as { credentials?: DidCredential[]; error?: string };
    if (!iRes.ok) throw new Error(iJson.error || `HTTP ${iRes.status}`);
    if (!cRes.ok) throw new Error(cJson.error || `HTTP ${cRes.status}`);
    setIdentities(iJson.identities ?? []);
    setCredentials(cJson.credentials ?? []);
  }

  useEffect(() => {
    void reload().catch((e) => setMsg(String(e)));
    const t = setInterval(() => void reload().catch(() => void 0), 9000);
    return () => clearInterval(t);
  }, []);

  async function onCreateIdentity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/did/identities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          controller: String(fd.get("controller") ?? "").trim(),
          walletAddress: String(fd.get("walletAddress") ?? "").trim() || undefined,
          label: String(fd.get("label") ?? "").trim() || undefined
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      e.currentTarget.reset();
      setMsg(isSpanish ? "Identidad DID creada." : "DID identity created.");
      await reload();
    } catch (error) {
      setMsg(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function onIssueCredential(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/did/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectDid: String(fd.get("subjectDid") ?? "").trim(),
          type: String(fd.get("type") ?? "").trim(),
          claims: String(fd.get("claims") ?? "").trim() || "{}",
          expiresAt: String(fd.get("expiresAt") ?? "").trim() || undefined
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      e.currentTarget.reset();
      setMsg(isSpanish ? "Credencial emitida." : "Credential issued.");
      await reload();
    } catch (error) {
      setMsg(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCredential(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/did/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credentialId: String(fd.get("credentialId") ?? "").trim() })
      });
      const json = (await res.json()) as { ok?: boolean; result?: { status?: string }; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg(
        isSpanish
          ? `Verificacion: ${json.result?.status ?? "unknown"}`
          : `Verification: ${json.result?.status ?? "unknown"}`
      );
    } catch (error) {
      setMsg(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeCredential(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/did/credentials/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          credentialId: String(fd.get("credentialId") ?? "").trim(),
          reason: String(fd.get("reason") ?? "").trim() || undefined
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg(isSpanish ? "Credencial revocada." : "Credential revoked.");
      await reload();
    } catch (error) {
      setMsg(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function resolveDid(did: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/did/public/resolve?did=${encodeURIComponent(did)}`, { cache: "no-store" });
      const json = (await res.json()) as { didDocument?: unknown; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setDocPreview(JSON.stringify(json.didDocument, null, 2));
    } catch (error) {
      setMsg(String(error));
      setDocPreview("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <Navbar title="DID" />
      <ModuleGuide
        whatThisDoes="This module manages decentralized identities, verifiable credentials, verification checks, and revocation workflow controls."
        whatToTry="Create one DID identity, issue one credential, verify it, and then test revocation governance controls."
        walletHint="Use wallet-linked identity from Profile when needed; DID records and credentials remain policy-controlled through admin/risk roles."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-bpvp-border bg-[#101523] p-4">
          <p className="text-xs text-bpvp-muted">{isSpanish ? "Identidades DID" : "DID identities"}</p>
          <p className="text-2xl font-semibold text-bpvp-ink">{identities.length}</p>
        </div>
        <div className="rounded-lg border border-bpvp-border bg-[#101523] p-4">
          <p className="text-xs text-bpvp-muted">{isSpanish ? "Credenciales activas" : "Active credentials"}</p>
          <p className="text-2xl font-semibold text-bpvp-ink">
            {credentials.filter((x) => x.status === "active").length}
          </p>
        </div>
        <div className="rounded-lg border border-bpvp-border bg-[#101523] p-4">
          <p className="text-xs text-bpvp-muted">{isSpanish ? "Credenciales revocadas" : "Revoked credentials"}</p>
          <p className="text-2xl font-semibold text-bpvp-ink">
            {credentials.filter((x) => x.status === "revoked").length}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={onCreateIdentity} className="space-y-2 rounded-lg border border-bpvp-border bg-[#101523] p-4">
          <h3 className="font-semibold text-bpvp-ink">{isSpanish ? "Crear identidad DID" : "Create DID identity"}</h3>
          <input name="controller" required placeholder={isSpanish ? "Controller (ej. org.bpvp.admin)" : "Controller (e.g. org.bpvp.admin)"} className="w-full bpvp-field" />
          <input name="walletAddress" placeholder={isSpanish ? "Wallet BTC/EVM (opcional) ej. 0x1111111111111111111111111111111111111111" : "Wallet BTC/EVM (optional) e.g. 0x1111111111111111111111111111111111111111"} className="w-full bpvp-field" />
          <input name="label" placeholder={isSpanish ? "Etiqueta (opcional) ej. cliente-enterprise-01" : "Label (optional) e.g. client-enterprise-01"} className="w-full bpvp-field" />
          <button disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
            {isSpanish ? "Crear identidad" : "Create identity"}
          </button>
        </form>

        <form onSubmit={onIssueCredential} className="space-y-2 rounded-lg border border-bpvp-border bg-[#101523] p-4">
          <h3 className="font-semibold text-bpvp-ink">{isSpanish ? "Emitir credencial" : "Issue credential"}</h3>
          <input name="subjectDid" required placeholder="did:bpvp:abc12345-def6-7890-gh12" className="w-full bpvp-field font-mono text-xs" />
          <input name="type" required placeholder={isSpanish ? "Tipo (ej. KYCVerified)" : "Type (e.g. KYCVerified)"} className="w-full bpvp-field" />
          <textarea name="claims" defaultValue={'{"kycLevel":"gold","jurisdiction":"PA","accredited":true}'} className="h-24 w-full bpvp-field font-mono text-xs" />
          <input name="expiresAt" placeholder={isSpanish ? "Expira ISO (opcional) ej. 2027-12-31T23:59:59Z" : "Expires ISO (optional) e.g. 2027-12-31T23:59:59Z"} className="w-full bpvp-field" />
          <button disabled={busy} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            {isSpanish ? "Emitir credencial" : "Issue credential"}
          </button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={onVerifyCredential} className="space-y-2 rounded-lg border border-bpvp-border bg-[#101523] p-4">
          <h3 className="font-semibold text-bpvp-ink">{isSpanish ? "Verificar credencial" : "Verify credential"}</h3>
          <input name="credentialId" required placeholder="vc_bpvp_8f2a1b7c9d" className="w-full bpvp-field font-mono text-xs" />
          <button disabled={busy} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500">
            {isSpanish ? "Verificar" : "Verify"}
          </button>
        </form>
        <form onSubmit={onRevokeCredential} className="space-y-2 rounded-lg border border-bpvp-border bg-[#101523] p-4">
          <h3 className="font-semibold text-bpvp-ink">{isSpanish ? "Revocar credencial (admin)" : "Revoke credential (admin)"}</h3>
          <input name="credentialId" required placeholder="vc_bpvp_8f2a1b7c9d" className="w-full bpvp-field font-mono text-xs" />
          <input name="reason" placeholder={isSpanish ? "Motivo (opcional) ej. documento expirado" : "Reason (optional) e.g. document expired"} className="w-full bpvp-field" />
          <button disabled={busy} className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500">
            {isSpanish ? "Revocar" : "Revoke"}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-bpvp-border bg-[#101523] p-4">
        <h3 className="mb-2 font-semibold text-bpvp-ink">{isSpanish ? "Identidades DID" : "DID identities"}</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bpvp-muted">
                <th className="pb-2">DID</th>
                <th className="pb-2">{isSpanish ? "Controller" : "Controller"}</th>
                <th className="pb-2">Wallet</th>
                <th className="pb-2">{isSpanish ? "Estado" : "Status"}</th>
                <th className="pb-2">{isSpanish ? "Resolver" : "Resolve"}</th>
              </tr>
            </thead>
            <tbody>
              {identities.map((d) => (
                <tr key={d.did} className="border-t border-bpvp-border text-bpvp-ink">
                  <td className="py-2 font-mono text-xs">{d.did}</td>
                  <td className="py-2">{d.controller}</td>
                  <td className="py-2 font-mono text-xs">{d.walletAddress ?? "—"}</td>
                  <td className="py-2">{d.status}</td>
                  <td className="py-2">
                    <button className="rounded border border-bpvp-border px-2 py-1 text-xs text-bpvp-ink hover:bg-bpvp-hover" onClick={() => void resolveDid(d.did)}>
                      {isSpanish ? "Ver doc" : "View doc"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-bpvp-border bg-[#101523] p-4">
        <h3 className="mb-2 font-semibold text-bpvp-ink">{isSpanish ? "Credenciales" : "Credentials"}</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bpvp-muted">
                <th className="pb-2">ID</th>
                <th className="pb-2">DID</th>
                <th className="pb-2">{isSpanish ? "Tipo" : "Type"}</th>
                <th className="pb-2">{isSpanish ? "Emisor" : "Issuer"}</th>
                <th className="pb-2">{isSpanish ? "Estado" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr key={c.id} className="border-t border-bpvp-border text-bpvp-ink">
                  <td className="py-2 font-mono text-xs">{c.id}</td>
                  <td className="py-2 font-mono text-xs">{c.subjectDid}</td>
                  <td className="py-2">{c.type}</td>
                  <td className="py-2">{c.issuer}</td>
                  <td className="py-2">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-bpvp-border bg-[#101523] p-4">
        <h3 className="mb-2 font-semibold text-bpvp-ink">{isSpanish ? "Vista DID document" : "DID document preview"}</h3>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-bpvp-card p-3 text-xs text-bpvp-ink">
          {docPreview || (isSpanish ? "Selecciona una identidad y pulsa 'Ver doc'." : "Select an identity and click 'View doc'.")}
        </pre>
      </div>

      {msg ? <p className="rounded-md border border-bpvp-border bg-bpvp-hover p-3 text-sm text-bpvp-ink">{msg}</p> : null}
    </section>
  );
}
