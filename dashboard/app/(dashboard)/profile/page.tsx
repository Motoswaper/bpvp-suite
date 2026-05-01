"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/lib/useLocale";

type Summary = {
  ok: boolean;
  session?: {
    username: string;
    role: string;
    mfa: boolean;
    walletAddress?: string | null;
    walletVerificationMethod?: "evm_personal_sign" | "bitcoin_message" | null;
    walletNetwork?: "evm-test" | "signet-testnet" | null;
  };
  integration?: {
    engineReachable: boolean;
    engineModules: string[];
    engineUrlConfigured: boolean;
    hasServerApiKey: boolean;
    hasServerHmac: boolean;
  };
};

function inferWalletSecurity(
  address: string | null | undefined,
  isSpanish: boolean,
  method?: "evm_personal_sign" | "bitcoin_message" | null,
  network?: "evm-test" | "signet-testnet" | null
) {
  if (address && method && network) {
    const networkLabel =
      network === "signet-testnet"
        ? "Bitcoin Signet/Testnet"
        : isSpanish
          ? "Entorno de pruebas EVM (sesion)"
          : "EVM test environment (session)";
    const methodLabel =
      method === "bitcoin_message"
        ? isSpanish
          ? "Firma de mensaje Bitcoin"
          : "Bitcoin message signature"
        : "personal_sign (EVM)";
    const postureLabel =
      network === "signet-testnet"
        ? isSpanish
          ? "Seguro (bloqueado a red de pruebas)"
          : "Safe (locked to test network)"
        : isSpanish
          ? "Controlado (solo sesion de prueba)"
          : "Controlled (test session only)";
    return {
      linked: true,
      network: networkLabel,
      method: methodLabel,
      posture: postureLabel
    };
  }
  const value = String(address ?? "").trim().toLowerCase();
  if (!value) {
    return {
      linked: false,
      network: isSpanish ? "Sin wallet vinculada" : "No linked wallet",
      method: isSpanish ? "No aplica" : "N/A",
      posture: isSpanish ? "Seguro (sin firma activa)" : "Safe (no active signature)"
    };
  }
  if (value.startsWith("0x")) {
    return {
      linked: true,
      network: isSpanish ? "Entorno de pruebas EVM (sesion)" : "EVM test environment (session)",
      method: "personal_sign (EVM)",
      posture: isSpanish ? "Controlado (solo sesion de prueba)" : "Controlled (test session only)"
    };
  }
  if (value.startsWith("tb1") || value.startsWith("m") || value.startsWith("n") || value.startsWith("2")) {
    return {
      linked: true,
      network: "Bitcoin Signet/Testnet",
      method: isSpanish ? "Firma de mensaje Bitcoin" : "Bitcoin message signature",
      posture: isSpanish ? "Seguro (bloqueado a red de pruebas)" : "Safe (locked to test network)"
    };
  }
  return {
    linked: true,
    network: isSpanish ? "Red no clasificada" : "Unclassified network",
    method: isSpanish ? "Metodo no clasificado" : "Unclassified method",
    posture: isSpanish ? "Revisar manualmente" : "Review manually"
  };
}

export default function Page() {
  const { isSpanish } = useLocale();
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [btcWalletBusy, setBtcWalletBusy] = useState(false);
  const [walletInfo, setWalletInfo] = useState("");
  const [btcNonce, setBtcNonce] = useState("");
  const [btcMessage, setBtcMessage] = useState("");
  const [btcAddress, setBtcAddress] = useState("");
  const [btcSignature, setBtcSignature] = useState("");
  const isAdmin = data?.session?.role === "admin";
  const walletSecurity = inferWalletSecurity(
    data?.session?.walletAddress,
    isSpanish,
    data?.session?.walletVerificationMethod ?? null,
    data?.session?.walletNetwork ?? null
  );

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/summary", { cache: "no-store" });
        const j = (await res.json()) as Summary;
        if (!stop) {
          if (!res.ok) {
            setErr("Not signed in or summary unavailable.");
            setData(null);
          } else {
            setData(j);
            setErr("");
          }
        }
      } catch (e) {
        if (!stop) setErr(String(e));
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  async function connectWallet() {
    setWalletBusy(true);
    setWalletInfo("");
    setErr("");
    try {
      const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) {
        throw new Error(isSpanish ? "No se detecto wallet en el navegador." : "No browser wallet detected.");
      }
      const accountsRaw = await ethereum.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(accountsRaw) ? (accountsRaw as string[]) : [];
      const address = String(accounts[0] ?? "").trim();
      if (!address) {
        throw new Error(isSpanish ? "No se pudo obtener direccion de wallet." : "Could not get wallet address.");
      }

      const challengeRes = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" }
      });
      const challengeBody = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !challengeBody?.ok) {
        throw new Error(challengeBody?.error || (isSpanish ? "Fallo al crear challenge." : "Failed to create challenge."));
      }
      const message = String(challengeBody.challenge?.message ?? "");
      const nonce = String(challengeBody.challenge?.nonce ?? "");
      if (!message || !nonce) {
        throw new Error(isSpanish ? "Challenge invalido." : "Invalid challenge.");
      }

      const signatureRaw = await ethereum.request({
        method: "personal_sign",
        params: [message, address]
      });
      const signature = String(signatureRaw ?? "").trim();
      if (!signature) {
        throw new Error(isSpanish ? "Firma no recibida." : "Signature not received.");
      }

      const verifyRes = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, nonce, signature })
      });
      const verifyBody = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyBody?.ok) {
        throw new Error(verifyBody?.error || (isSpanish ? "Fallo validando firma." : "Signature verification failed."));
      }

      setWalletInfo(
        isSpanish
          ? `Wallet vinculada: ${String(verifyBody.walletAddress ?? address)}`
          : `Wallet linked: ${String(verifyBody.walletAddress ?? address)}`
      );

      const refresh = await fetch("/api/profile/summary", { cache: "no-store" });
      const refreshed = (await refresh.json().catch(() => ({}))) as Summary;
      if (refresh.ok) setData(refreshed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : isSpanish ? "Error conectando wallet." : "Wallet connection error.");
    } finally {
      setWalletBusy(false);
    }
  }

  async function requestBitcoinChallenge() {
    const challengeRes = await fetch("/api/auth/wallet/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" }
    });
    const challengeBody = await challengeRes.json().catch(() => ({}));
    if (!challengeRes.ok || !challengeBody?.ok) {
      throw new Error(challengeBody?.error || (isSpanish ? "Fallo al crear challenge." : "Failed to create challenge."));
    }
    const message = String(challengeBody.challenge?.message ?? "");
    const nonce = String(challengeBody.challenge?.nonce ?? "");
    if (!message || !nonce) {
      throw new Error(isSpanish ? "Challenge invalido." : "Invalid challenge.");
    }
    setBtcMessage(message);
    setBtcNonce(nonce);
    return { message, nonce };
  }

  async function verifyBitcoinSignature(address: string, nonce: string, signature: string) {
    const verifyRes = await fetch("/api/auth/wallet/verify-bitcoin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, nonce, signature })
    });
    const verifyBody = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !verifyBody?.ok) {
      throw new Error(
        verifyBody?.error ||
          (isSpanish ? "Fallo validando firma Bitcoin." : "Bitcoin signature verification failed.")
      );
    }
    setWalletInfo(
      isSpanish
        ? `Wallet Bitcoin vinculada: ${String(verifyBody.walletAddress ?? address)}`
        : `Bitcoin wallet linked: ${String(verifyBody.walletAddress ?? address)}`
    );
    const refresh = await fetch("/api/profile/summary", { cache: "no-store" });
    const refreshed = (await refresh.json().catch(() => ({}))) as Summary;
    if (refresh.ok) setData(refreshed);
  }

  async function connectBitcoinWallet() {
    setBtcWalletBusy(true);
    setWalletInfo("");
    setErr("");
    try {
      const w = window as Window & {
        unisat?: {
          requestAccounts: () => Promise<string[]>;
          getAccounts: () => Promise<string[]>;
          signMessage: (message: string) => Promise<string>;
        };
        okxwallet?: {
          bitcoin?: {
            connect: () => Promise<{ address?: string } | { addresses?: Array<{ address?: string }> }>;
            signMessage: (message: string, options?: { from?: string }) => Promise<string>;
          };
        };
      };
      const challenge = await requestBitcoinChallenge();

      // Provider path 1: Unisat-compatible
      if (w.unisat) {
        await w.unisat.requestAccounts();
        const accounts = await w.unisat.getAccounts();
        const address = String(accounts?.[0] ?? "").trim();
        if (!address) {
          throw new Error(isSpanish ? "No se obtuvo direccion Bitcoin." : "Could not get Bitcoin address.");
        }
        const signature = String(await w.unisat.signMessage(challenge.message)).trim();
        if (!signature) {
          throw new Error(isSpanish ? "No se recibio firma Bitcoin." : "No Bitcoin signature received.");
        }
        setBtcAddress(address);
        setBtcSignature(signature);
        await verifyBitcoinSignature(address, challenge.nonce, signature);
        return;
      }

      // Provider path 2: OKX wallet (bitcoin namespace)
      if (w.okxwallet?.bitcoin) {
        const connected = await w.okxwallet.bitcoin.connect();
        let address = "";
        if ("addresses" in connected) {
          address = String(connected.addresses?.[0]?.address ?? "").trim();
        } else if ("address" in connected) {
          address = String(connected.address ?? "").trim();
        }
        if (!address) {
          throw new Error(isSpanish ? "No se obtuvo direccion Bitcoin de OKX." : "Could not get Bitcoin address from OKX.");
        }
        const signature = String(await w.okxwallet.bitcoin.signMessage(challenge.message, { from: address })).trim();
        if (!signature) {
          throw new Error(isSpanish ? "No se recibio firma Bitcoin." : "No Bitcoin signature received.");
        }
        setBtcAddress(address);
        setBtcSignature(signature);
        await verifyBitcoinSignature(address, challenge.nonce, signature);
        return;
      }

      throw new Error(
        isSpanish
          ? "No se detecto wallet Bitcoin compatible (Unisat/OKX). Usa modo manual."
          : "No compatible Bitcoin wallet detected (Unisat/OKX). Use manual mode."
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : isSpanish ? "Error conectando wallet Bitcoin." : "Bitcoin wallet connection error.");
    } finally {
      setBtcWalletBusy(false);
    }
  }

  async function verifyBitcoinManual() {
    setBtcWalletBusy(true);
    setWalletInfo("");
    setErr("");
    try {
      const address = btcAddress.trim();
      const signature = btcSignature.trim();
      if (!address || !signature || !btcNonce) {
        throw new Error(
          isSpanish
            ? "Completa direccion, firma y challenge antes de verificar."
            : "Fill address, signature, and challenge before verify."
        );
      }
      await verifyBitcoinSignature(address, btcNonce, signature);
    } catch (e) {
      setErr(e instanceof Error ? e.message : isSpanish ? "Error en verificacion manual." : "Manual verification error.");
    } finally {
      setBtcWalletBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <Navbar title="Profile" />
      <ModuleGuide
        whatThisDoes="This module shows your active session, role, and backend integration readiness."
        whatToTry="Confirm your tester username/role, then use the wallet linking steps below if you need signed wallet identity in tests."
        walletHint="Wallet linking exists via API endpoints today. A wallet can be attached to your session after challenge-sign-verify flow."
      />
      <p className="text-sm text-slate-400">
        {isSpanish
          ? "Resumen de sesion y flujo de vinculacion de wallet para tu cuenta de prueba."
          : "Session overview and wallet-link workflow for your current test account."}
      </p>

      <Card title="Session">
        {data?.session ? (
          <ul className="text-sm text-slate-300">
            <li>
              <span className="text-slate-500">{isSpanish ? "Usuario:" : "User:"}</span> {data.session.username}
            </li>
            <li>
              <span className="text-slate-500">{isSpanish ? "Rol:" : "Role:"}</span> {data.session.role}
            </li>
            <li>
              <span className="text-slate-500">MFA:</span> {data.session.mfa ? (isSpanish ? "activado" : "on") : isSpanish ? "desactivado" : "off"}
            </li>
            <li>
              <span className="text-slate-500">{isSpanish ? "Wallet:" : "Wallet:"}</span>{" "}
              {data.session.walletAddress ? data.session.walletAddress : isSpanish ? "no vinculada" : "not linked"}
            </li>
          </ul>
        ) : (
          <p className="text-sm text-slate-400">{err || "Loading…"}</p>
        )}
      </Card>

      <Card title={isSpanish ? "Health y Security de Wallet" : "Wallet Health & Security"}>
        <ul className="space-y-1 text-sm text-slate-300">
          <li>
            <span className="text-slate-500">{isSpanish ? "Vinculada:" : "Linked:"}</span>{" "}
            {walletSecurity.linked ? (isSpanish ? "si" : "yes") : isSpanish ? "no" : "no"}
          </li>
          <li>
            <span className="text-slate-500">{isSpanish ? "Red:" : "Network:"}</span> {walletSecurity.network}
          </li>
          <li>
            <span className="text-slate-500">{isSpanish ? "Metodo de validacion:" : "Validation method:"}</span>{" "}
            {walletSecurity.method}
          </li>
          <li>
            <span className="text-slate-500">{isSpanish ? "Postura de seguridad:" : "Security posture:"}</span>{" "}
            {walletSecurity.posture}
          </li>
        </ul>
      </Card>

      {isAdmin ? (
        <>
          <Card title="Engine integration (admin)">
            {data?.integration ? (
              <ul className="space-y-1 text-sm text-slate-300">
                <li>
                  <span className="text-slate-500">Reachable:</span> {data.integration.engineReachable ? "yes" : "no"}
                </li>
                <li>
                  <span className="text-slate-500">Custom ENGINE_URL set:</span> {data.integration.engineUrlConfigured ? "yes" : "no"}
                </li>
                <li>
                  <span className="text-slate-500">Server API key:</span> {data.integration.hasServerApiKey ? "configured" : "missing"}
                </li>
                <li>
                  <span className="text-slate-500">Server HMAC secret:</span> {data.integration.hasServerHmac ? "configured" : "missing"}
                </li>
                <li>
                  <span className="text-slate-500">Active modules:</span>{" "}
                  <span className="font-mono text-xs text-slate-400">{(data.integration.engineModules ?? []).join(", ") || "—"}</span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </Card>

          <Card title="Workspace (admin)">
            <p className="text-sm text-slate-400">
              Default workspace label: <strong className="text-slate-200">BPVP Ops</strong>. Point{" "}
              <code className="text-slate-300">ENGINE_URL</code>, <code className="text-slate-300">AXE_API_KEY</code>, and{" "}
              <code className="text-slate-300">AXE_HMAC_SECRET</code> at your running suite (see{" "}
              <code className="text-slate-300">bpvp-suite/.run/local-secrets.env</code> when using local scripts).
            </p>
          </Card>
        </>
      ) : null}

      <Card title={isSpanish ? "Conectar Wallet (metodo actual)" : "Wallet Connect (current method)"}>
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void connectWallet()}
            disabled={walletBusy}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {walletBusy
              ? isSpanish
                ? "Conectando..."
                : "Connecting..."
              : isSpanish
                ? "Conectar wallet"
                : "Connect wallet"}
          </button>
          <button
            type="button"
            onClick={() => void connectBitcoinWallet()}
            disabled={btcWalletBusy}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {btcWalletBusy
              ? isSpanish
                ? "Conectando BTC..."
                : "Connecting BTC..."
              : isSpanish
                ? "Conectar Bitcoin (Signet beta)"
                : "Connect Bitcoin (Signet beta)"}
          </button>
          <button
            type="button"
            onClick={() => void requestBitcoinChallenge()}
            disabled={btcWalletBusy}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSpanish ? "Generar challenge BTC" : "Generate BTC challenge"}
          </button>
          {walletInfo ? <p className="text-xs text-emerald-300">{walletInfo}</p> : null}
        </div>
        <div className="mb-3 grid gap-2">
          <input
            value={btcMessage}
            readOnly
            placeholder={isSpanish ? "Mensaje challenge para firmar" : "Challenge message to sign"}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300"
          />
          <input
            value={btcAddress}
            onChange={(e) => setBtcAddress(e.target.value)}
            placeholder={isSpanish ? "Direccion BTC testnet/signet (ej. tb1...)" : "BTC testnet/signet address (e.g. tb1...)"}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
          />
          <input
            value={btcSignature}
            onChange={(e) => setBtcSignature(e.target.value)}
            placeholder={isSpanish ? "Firma Bitcoin del mensaje challenge" : "Bitcoin signature for challenge message"}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
          />
          <div>
            <button
              type="button"
              onClick={() => void verifyBitcoinManual()}
              disabled={btcWalletBusy}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSpanish ? "Verificar firma manual" : "Verify signature manually"}
            </button>
          </div>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>
            {isSpanish ? "Llama " : "Call "}
            <code className="text-slate-200">POST /api/auth/wallet/challenge</code>
            {isSpanish ? " con sesion iniciada." : " while signed in."}
          </li>
          <li>
            {isSpanish ? "Firma el mensaje " : "Sign returned message "}
            <code className="text-slate-200">BPVP wallet link nonce: ...</code>
            {isSpanish ? " en tu wallet." : " in your wallet."}
          </li>
          <li>
            {isSpanish ? "Llama " : "Call "}
            <code className="text-slate-200">POST /api/auth/wallet/verify</code>
            {isSpanish ? " con " : " with "}
            <code className="text-slate-200">address</code>, <code className="text-slate-200">nonce</code>
            {isSpanish ? " y " : ", and "}
            <code className="text-slate-200">signature</code>.
          </li>
          <li>{isSpanish ? "Si es exitoso, la sesion se reemite con wallet vinculada." : "On success, session is reissued with linked wallet address."}</li>
        </ol>
        <p className="mt-3 text-xs text-slate-400">
          {isSpanish
            ? "Nota: se agrego beta para wallet Bitcoin (Unisat/OKX + modo manual). Para cobertura institucional completa falta fase de compatibilidad ampliada BIP-322/PSBT multi-wallet."
            : "Note: Bitcoin wallet beta is now added (Unisat/OKX + manual mode). Full institutional coverage still requires expanded multi-wallet BIP-322/PSBT compatibility phase."}
        </p>
      </Card>
    </section>
  );
}
