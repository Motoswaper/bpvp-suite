"use client";

import { FormEvent, useEffect, useState } from "react";

const REQUEST_TIMEOUT_MS = 7000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function LoginPage() {
  const [isSpanish, setIsSpanish] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const AUTO_REDIRECT_KEY = "bpvp_login_auto_redirect_once";
    setIsSpanish(document.cookie.includes("bpvp_locale=es"));
    const url = new URL(window.location.href);
    const forceLogin = url.searchParams.get("force") === "1";
    const registerError = url.searchParams.get("registerError");
    if (registerError) {
      setError(registerError);
      url.searchParams.delete("registerError");
      window.history.replaceState({}, "", url.toString());
    }
    if (forceLogin) {
      window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
      setCheckingSession(false);
      return;
    }
    let active = true;
    const watchdog = window.setTimeout(() => {
      // Absolute failsafe: never keep user blocked indefinitely in checking state.
      if (active) setCheckingSession(false);
    }, 6000);
    (async () => {
      try {
        const res = await fetchWithTimeout("/api/auth/session", { cache: "no-store" }, 5000);
        if (!active) return;
        if (res.ok) {
          const alreadyTried = window.sessionStorage.getItem(AUTO_REDIRECT_KEY) === "1";
          if (!alreadyTried) {
            window.sessionStorage.setItem(AUTO_REDIRECT_KEY, "1");
            window.location.href = "/market";
            return;
          }
        }
      } catch {
        /* network / tunnel blip — still show login form */
      }
      window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
      if (active) setCheckingSession(false);
    })();
    return () => {
      active = false;
      window.clearTimeout(watchdog);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setError("");
    setInfo("");
    try {
      const res = await fetchWithTimeout("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, otp: otp || undefined })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ? String(body.error) : isSpanish ? "Credenciales invalidas" : "Invalid credentials");
        return;
      }
      setInfo(isSpanish ? "Sesion creada. Redirigiendo..." : "Session created. Redirecting...");
      window.sessionStorage.removeItem("bpvp_login_auto_redirect_once");
      window.location.href = "/market";
    } finally {
      setSigningIn(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05070f]">
        <div className="rounded-xl border border-slate-800 bg-[#101523] px-5 py-4 text-sm text-slate-300">
          {isSpanish ? "Verificando sesion..." : "Checking session..."}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070f] px-4">
      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-800 bg-[#101523] p-6">
          <img src="/brand/bpvp-suite-logo.svg" alt="BPVP Suite logo" className="h-auto w-full rounded-md border border-slate-800 bg-slate-950/50 p-2" />
          <h1 className="text-xl font-semibold">{isSpanish ? "Inicia sesion con usuario tester existente" : "Sign in with existing tester user"}</h1>
          <p className="text-xs text-slate-400">
            {isSpanish
              ? "Usa esta opcion solo si ya tienes usuario y password."
              : "Use this only if you already have username and password."}
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isSpanish ? "Usuario (ej. tester-7gk2p4)" : "Username (e.g. tester-7gk2p4)"}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSpanish ? "Password (ej. A9v!kP2#tQ)" : "Password (e.g. A9v!kP2#tQ)"}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder={isSpanish ? "Codigo OTP (solo si aplica) ej. 483920" : "OTP code (only if required) e.g. 483920"}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={signingIn}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingIn ? (isSpanish ? "Iniciando sesion..." : "Signing in...") : isSpanish ? "Iniciar sesion" : "Sign in"}
            </button>
          </form>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-[#101523] p-6">
          <h2 className="text-xl font-semibold">{isSpanish ? "Crea un nuevo usuario de prueba" : "Create a new test user"}</h2>
          <p className="text-xs text-slate-400">
            {isSpanish
              ? "Recomendado para la mayoria de testers. Crea una cuenta viewer e inicia sesion automaticamente."
              : "Recommended for most testers. This creates a viewer-only account and signs in automatically."}
          </p>
          <form action="/api/auth/register?redirect=1" method="post">
            <button
              type="submit"
              disabled={signingIn}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSpanish ? "Crear cuenta de prueba (solo viewer)" : "Create test account (viewer only)"}
            </button>
          </form>
        </section>
      </div>
      <div className="fixed bottom-4 left-4 right-4 mx-auto max-w-3xl">
        {error ? <p className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">{error}</p> : null}
        {info ? <p className="mt-2 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-emerald-300">{info}</p> : null}
      </div>
    </main>
  );
}
