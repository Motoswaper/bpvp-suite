"use client";

import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ModuleGuide } from "@/components/layout/ModuleGuide";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/lib/useLocale";

type BtcWindow = Window & {
  unisat?: {
    requestAccounts: () => Promise<string[]>;
    getAccounts: () => Promise<string[]>;
    signMessage: (message: string, type?: string) => Promise<string>;
  };
  okxwallet?: {
    bitcoin?: {
      connect: () => Promise<{ address?: string } | { addresses?: Array<{ address?: string }> }>;
      signMessage: (message: string, options?: { from?: string }) => Promise<string>;
    };
  };
};

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
  const [btcProofInput, setBtcProofInput] = useState("");
  /** Set by "prepare extension" so the sign click can call signMessage as the first await (browser user-gesture / UniSat popup). */
  const [btcExtensionAddress, setBtcExtensionAddress] = useState("");
  /** Ref mirrors — signing handler must not call setState before signMessage (breaks user activation / UniSat popup). */
  const btcChallengeRef = useRef<{ message: string; nonce: string } | null>(null);
  const btcExtensionAddrRef = useRef<string>("");
  const isAdmin = data?.session?.role === "admin";
  const walletSecurity = inferWalletSecurity(
    data?.session?.walletAddress,
    isSpanish,
    data?.session?.walletVerificationMethod ?? null,
    data?.session?.walletNetwork ?? null
  );

  async function refreshSummary() {
    const res = await fetch("/api/profile/summary", { cache: "no-store" });
    const j = (await res.json().catch(() => ({}))) as Summary;
    if (!res.ok) {
      setErr("Not signed in or summary unavailable.");
      setData(null);
      return;
    }
    setData(j);
    setErr("");
  }

  useEffect(() => {
    void refreshSummary().catch((e) => setErr(String(e)));
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

      await refreshSummary();
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
    btcChallengeRef.current = { message, nonce };
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      }
    } catch {
      // no-op: clipboard may be blocked by browser policy
    }
    return { message, nonce };
  }

  async function generateBitcoinChallengeSafe() {
    setErr("");
    try {
      await requestBitcoinChallenge();
    } catch (e) {
      setErr(e instanceof Error ? e.message : isSpanish ? "Fallo al crear challenge." : "Failed to create challenge.");
    }
  }

  async function prepareBitcoinExtension() {
    setBtcWalletBusy(true);
    setWalletInfo("");
    setErr("");
    try {
      const w = window as BtcWindow;
      if (w.unisat) {
        await w.unisat.requestAccounts();
        const accounts = await w.unisat.getAccounts();
        const address = String(accounts?.[0] ?? "").trim();
        if (!address) {
          throw new Error(isSpanish ? "No se obtuvo direccion Bitcoin." : "Could not get Bitcoin address.");
        }
        setBtcExtensionAddress(address);
        setBtcAddress(address);
        btcExtensionAddrRef.current = address;
        setWalletInfo(
          isSpanish
            ? `Extension lista: ${address} (siguiente: generar challenge y pulsar solicitar firma).`
            : `Extension ready: ${address} (next: generate challenge, then request signature).`
        );
        return;
      }
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
        setBtcExtensionAddress(address);
        setBtcAddress(address);
        btcExtensionAddrRef.current = address;
        setWalletInfo(
          isSpanish
            ? `OKX Bitcoin lista: ${address} (siguiente: challenge y solicitar firma).`
            : `OKX Bitcoin ready: ${address} (next: challenge, then request signature).`
        );
        return;
      }
      throw new Error(
        isSpanish
          ? "No se detecto UniSat ni OKX Bitcoin. Instala la extension o usa modo manual."
          : "UniSat or OKX Bitcoin not detected. Install the extension or use manual mode."
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : isSpanish ? "Error preparando extension." : "Extension prepare failed.");
    } finally {
      setBtcWalletBusy(false);
    }
  }

  /**
   * Do not call setState before signMessage: React updates can consume the browser "user activation"
   * token and UniSat will not show the signing popup (other sites work; this page did not).
   * Use refs for message/nonce/address; first await in the click path should be signMessage.
   */
  async function requestBitcoinExtensionSignature() {
    const payload = btcChallengeRef.current;
    const extAddr = btcExtensionAddrRef.current;
    if (!payload?.message || !payload.nonce) {
      setErr(isSpanish ? "Primero genera el challenge." : "Generate the challenge first.");
      return;
    }
    if (!extAddr) {
      setErr(
        isSpanish
          ? "Primero pulsa Preparar extension (UniSat/OKX)."
          : "Click Prepare extension (UniSat/OKX) first."
      );
      return;
    }
    const w = window as BtcWindow;
    if (!w.unisat && !w.okxwallet?.bitcoin) {
      setErr(
        isSpanish
          ? "No se detecto extension Bitcoin en esta pagina."
          : "No Bitcoin extension detected on this page."
      );
      return;
    }

    let signature: string;
    try {
      if (w.unisat) {
        // Single await — retrying signMessage here loses user activation and the popup may never show.
        signature = String(await w.unisat.signMessage(payload.message)).trim();
      } else if (w.okxwallet?.bitcoin) {
        signature = String(
          await w.okxwallet.bitcoin.signMessage(payload.message, { from: extAddr })
        ).trim();
      } else {
        return;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : isSpanish ? "Firma cancelada o fallida." : "Signing cancelled or failed.");
      return;
    }

    if (!signature) {
      setErr(isSpanish ? "No se recibio firma Bitcoin." : "No Bitcoin signature received.");
      return;
    }

    setBtcWalletBusy(true);
    setErr("");
    try {
      setBtcSignature(signature);
      await verifyBitcoinSignature(extAddr, payload.nonce, signature);
    } catch (e) {
      setErr(e instanceof Error ? e.message : isSpanish ? "Error verificando firma." : "Verification failed.");
    } finally {
      setBtcWalletBusy(false);
    }
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
    await refreshSummary();
  }

  async function connectBitcoinWallet() {
    setBtcWalletBusy(true);
    setWalletInfo("");
    setErr("");
    try {
      const w = window as BtcWindow;
      const challenge = await requestBitcoinChallenge();

      // Provider path 1: Unisat-compatible
      if (w.unisat) {
        await w.unisat.requestAccounts();
        const accounts = await w.unisat.getAccounts();
        const address = String(accounts?.[0] ?? "").trim();
        if (!address) {
          throw new Error(isSpanish ? "No se obtuvo direccion Bitcoin." : "Could not get Bitcoin address.");
        }
        btcExtensionAddrRef.current = address;
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
        btcExtensionAddrRef.current = address;
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

  function extractAddressAndSignature(rawInput: string): { address: string; signature: string } | null {
    const raw = rawInput.trim();
    if (!raw) return null;

    // Accept JSON payloads from wallet tooling.
    try {
      const parsed = JSON.parse(raw) as { address?: unknown; signature?: unknown };
      const address = String(parsed?.address ?? "").trim();
      const signature = String(parsed?.signature ?? "").trim();
      if (address && signature) {
        return { address, signature };
      }
    } catch {
      // continue with plain-text parsing
    }

    // Accept plain lines like: "address: ...", "signature: ..."
    const lines = raw.split(/\r?\n/);
    let address = "";
    let signature = "";
    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;
      const low = clean.toLowerCase();
      if (!address && (low.startsWith("address:") || low.startsWith("direccion:"))) {
        address = clean.split(":").slice(1).join(":").trim();
      }
      if (!signature && (low.startsWith("signature:") || low.startsWith("firma:"))) {
        signature = clean.split(":").slice(1).join(":").trim();
      }
    }

    if (address && signature) return { address, signature };
    return null;
  }

  async function verifyBitcoinFromPastedProof() {
    setBtcWalletBusy(true);
    setWalletInfo("");
    setErr("");
    try {
      if (!btcNonce) {
        throw new Error(isSpanish ? "Primero genera challenge BTC (Paso 1)." : "Generate BTC challenge first (Step 1).");
      }
      const parsed = extractAddressAndSignature(btcProofInput);
      if (!parsed) {
        throw new Error(
          isSpanish
            ? "No pude leer address + signature. Pega JSON {'address','signature'} o lineas 'address:' y 'signature:'."
            : "Could not read address + signature. Paste JSON {'address','signature'} or 'address:' and 'signature:' lines."
        );
      }
      setBtcAddress(parsed.address);
      setBtcSignature(parsed.signature);
      await verifyBitcoinSignature(parsed.address, btcNonce, parsed.signature);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : isSpanish
            ? "Error verificando bloque pegado."
            : "Error verifying pasted proof."
      );
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
        <div className="mb-3 rounded-md border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs text-cyan-100">
          <p className="font-semibold">{isSpanish ? "Instrucciones rapidas (recomendado)" : "Quick instructions (recommended)"}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              {isSpanish
                ? "Pulsa 'Preparar extension' (cuenta UniSat/OKX)."
                : "Click 'Prepare extension' (UniSat/OKX account)."}
            </li>
            <li>
              {isSpanish
                ? "Pulsa 'Generar challenge BTC' (se copia al portapapeles)."
                : "Click 'Generate BTC challenge' (auto-copies to clipboard)."}
            </li>
            <li>
              {isSpanish
                ? "Pulsa 'Solicitar firma en extension' — ahi se dispara el popup de UniSat/OKX (hace falta un clic dedicado)."
                : "Click 'Request extension signature' — that triggers the UniSat/OKX popup (dedicated click required)."}
            </li>
            <li>
              {isSpanish
                ? "Sin extension: con challenge generado, firma en tu wallet (CLI/BPVP Wallet) y usa 'Modo rapido' o los campos + Verificar."
                : "Without extension: after generating the challenge, sign in your wallet (CLI/BPVP Wallet), then use 'Quick mode' or fields + Verify."}
            </li>
            <li>
              {isSpanish
                ? "Debes ver 'wallet vinculada'; si no cambia, pulsa 'Refrescar sesion'."
                : "You should see 'wallet linked'; if it does not update, click 'Refresh session'."}
            </li>
          </ol>
          <p className="mt-2 text-[11px] text-cyan-200/90">
            {isSpanish
              ? "Formato aceptado en Modo rapido: JSON {'address','signature'} o lineas 'address:' y 'signature:'."
              : "Accepted Quick mode format: JSON {'address','signature'} or text lines 'address:' and 'signature:'."}
          </p>
          <p className="mt-2 rounded-md border border-amber-500/35 bg-amber-950/25 p-2 text-[11px] text-amber-100">
            <strong>{isSpanish ? "Por que hace falta un clic aparte:" : "Why a separate click:"}</strong>{" "}
            {isSpanish
              ? "El navegador solo deja abrir la firma de UniSat si el popup va ligado a tu clic. Si primero hacemos fetch del challenge en el mismo clic, muchas veces el popup no aparece. Por eso: Preparar extension -> Challenge -> Solicitar firma (3 clics)."
              : "Browsers only allow UniSat's signing popup when it is tied to your click. If we fetch the challenge in the same click, the popup often never opens. So: Prepare extension → Challenge → Request signature (3 clicks)."}
            {" "}
            <strong>{isSpanish ? "EVM:" : "EVM:"}</strong>{" "}
            {isSpanish
              ? "El boton azul es solo Ethereum/MetaMask, no UniSat."
              : "The blue button is Ethereum/MetaMask only — not UniSat."}
          </p>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
            title={
              isSpanish
                ? "Todo en un paso (puede fallar el popup en algunos navegadores). Mejor: Preparar + Challenge + Solicitar firma."
                : "One-shot (popup may fail in some browsers). Prefer: Prepare + Challenge + Request signature."
            }
          >
            {btcWalletBusy
              ? isSpanish
                ? "Conectando BTC..."
                : "Connecting BTC..."
              : isSpanish
                ? "Bitcoin todo-en-uno"
                : "Bitcoin one-shot"}
          </button>
          <button
            type="button"
            onClick={() => void prepareBitcoinExtension()}
            disabled={btcWalletBusy}
            className="rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSpanish ? "Preparar extension (UniSat/OKX)" : "Prepare extension (UniSat/OKX)"}
          </button>
          <button
            type="button"
            onClick={() => void generateBitcoinChallengeSafe()}
            disabled={btcWalletBusy}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSpanish ? "Generar challenge BTC" : "Generate BTC challenge"}
          </button>
          <button
            type="button"
            onClick={() => void requestBitcoinExtensionSignature()}
            disabled={
              btcWalletBusy || !btcMessage || !btcNonce || !btcExtensionAddress
            }
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSpanish ? "Solicitar firma (dispara UniSat)" : "Request signature (UniSat)"}
          </button>
          <button
            type="button"
            onClick={() => void refreshSummary()}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            {isSpanish ? "Refrescar sesion" : "Refresh session"}
          </button>
          {walletInfo ? <p className="text-xs text-emerald-300">{walletInfo}</p> : null}
        </div>
        <div className="mb-3 grid gap-2">
          <textarea
            value={btcProofInput}
            onChange={(e) => setBtcProofInput(e.target.value)}
            placeholder={
              isSpanish
                ? "Modo rapido: pega aqui address + signature en un solo bloque (JSON o lineas)."
                : "Quick mode: paste address + signature here as one block (JSON or text lines)."
            }
            rows={3}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
          />
          <div>
            <button
              type="button"
              onClick={() => void verifyBitcoinFromPastedProof()}
              disabled={btcWalletBusy}
              className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSpanish ? "Modo rapido: verificar bloque pegado" : "Quick mode: verify pasted block"}
            </button>
          </div>
          <input
            value={btcMessage}
            readOnly
            placeholder={
              isSpanish
                ? "Mensaje challenge para firmar (se copia al portapapeles)"
                : "Challenge message to sign (auto-copied to clipboard)"
            }
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300"
          />
          <input
            value={btcAddress}
            onChange={(e) => setBtcAddress(e.target.value)}
            placeholder={isSpanish ? "Paso 2: Pega direccion BTC (ej. tb1...)" : "Step 2: Paste BTC address (e.g. tb1...)"}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
          />
          <input
            value={btcSignature}
            onChange={(e) => setBtcSignature(e.target.value)}
            placeholder={isSpanish ? "Paso 3: Pega firma del challenge" : "Step 3: Paste signature for challenge"}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
          />
          <div>
            <button
              type="button"
              onClick={() => void verifyBitcoinManual()}
              disabled={btcWalletBusy}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSpanish ? "Paso 4: Verificar y vincular" : "Step 4: Verify and link"}
            </button>
          </div>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>
            {isSpanish
              ? "Flujo recomendado: Paso 1 (challenge) -> firma en wallet -> pega bloque -> Quick verify."
              : "Recommended flow: Step 1 (challenge) -> sign in wallet -> paste block -> Quick verify."}
          </li>
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
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-100">
          <p className="font-semibold">{isSpanish ? "Si algo falla" : "If something fails"}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              {isSpanish
                ? "Confirma que la direccion sea de pruebas (ej. empieza por tb1, m, n o 2)."
                : "Confirm address is test-network (e.g. starts with tb1, m, n, or 2)."}
            </li>
            <li>
              {isSpanish
                ? "Firma el mensaje completo sin editar ni quitar espacios."
                : "Sign the full message exactly; do not edit or trim spaces."}
            </li>
            <li>
              {isSpanish
                ? "Usa el mismo navegador/sesion para challenge y verify."
                : "Use the same browser session for challenge and verify."}
            </li>
            <li>{isSpanish ? "Si persiste, genera un challenge nuevo y repite." : "If it persists, generate a new challenge and retry."}</li>
          </ul>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {isSpanish
            ? "Nota: se agrego beta para wallet Bitcoin (Unisat/OKX + modo manual). Para cobertura institucional completa falta fase de compatibilidad ampliada BIP-322/PSBT multi-wallet."
            : "Note: Bitcoin wallet beta is now added (Unisat/OKX + manual mode). Full institutional coverage still requires expanded multi-wallet BIP-322/PSBT compatibility phase."}
        </p>
      </Card>
    </section>
  );
}
