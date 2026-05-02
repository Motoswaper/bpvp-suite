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
  const [sessionRecoveryLinks, setSessionRecoveryLinks] = useState(false);

  useEffect(() => {
    const AUTO_REDIRECT_KEY = "bpvp_login_auto_redirect_once";
    const REDIRECT_TS_KEY = "bpvp_auth_redirect_ts";
    const LOOP_WINDOW_MS = 12_000;

    setIsSpanish(document.cookie.includes("bpvp_locale=es"));
    const url = new URL(window.location.href);
    const forceLogin = url.searchParams.get("force") === "1";
    const registerError = url.searchParams.get("registerError");
    if (registerError) {
      setSessionRecoveryLinks(false);
      setError(registerError);
      url.searchParams.delete("registerError");
      window.history.replaceState({}, "", url.toString());
    }
    if (forceLogin) {
      window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
      window.sessionStorage.removeItem(REDIRECT_TS_KEY);
      return;
    }
    let active = true;
    (async () => {
      const spanish = document.cookie.includes("bpvp_locale=es");
      try {
        const res = await fetchWithTimeout("/api/auth/session", { cache: "no-store" }, 5000);
        if (!active) return;
        if (!res.ok) {
          window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
          window.sessionStorage.removeItem(REDIRECT_TS_KEY);
          if (active) setSessionRecoveryLinks(false);
          return;
        }

        const now = Date.now();
        const lastRedirect = Number(window.sessionStorage.getItem(REDIRECT_TS_KEY) || "0");
        if (lastRedirect && now - lastRedirect < LOOP_WINDOW_MS) {
          window.sessionStorage.removeItem(REDIRECT_TS_KEY);
          window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
          setSessionRecoveryLinks(true);
          setError(
            spanish
              ? "Detectamos un bucle rapido login ↔ dashboard. Suele pasar si la cookie de sesion no persiste (HTTP vs HTTPS, dominio distinto, o SameSite). Prueba abrir /market en la misma pestaña, o entra con ?force=1 para quedarte aqui y volver a iniciar sesion."
              : "Detected a fast login ↔ dashboard loop. Usually the session cookie is not persisting (HTTP vs HTTPS, different host, or SameSite). Try opening /market in this tab, or use ?force=1 to stay here and sign in again."
          );
          return;
        }

        const alreadyTried = window.sessionStorage.getItem(AUTO_REDIRECT_KEY) === "1";
        if (!alreadyTried) {
          window.sessionStorage.setItem(REDIRECT_TS_KEY, String(now));
          window.sessionStorage.setItem(AUTO_REDIRECT_KEY, "1");
          window.location.href = "/market";
          return;
        }

        window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
        window.sessionStorage.removeItem(REDIRECT_TS_KEY);
        setSessionRecoveryLinks(true);
        setError(
          spanish
            ? "Tu sesion parece activa pero volviste a login (posible bucle o bloqueo de cookie). Abre /market manualmente, o cierra sesion desde el dashboard y entra de nuevo. Para quedarte en esta pantalla usa ?force=1."
            : "You appear signed in but landed on login again (redirect loop or cookie blocked). Open /market manually, or sign out from the dashboard and sign in again. To stay on this screen use ?force=1."
        );
      } catch {
        window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
        window.sessionStorage.removeItem(REDIRECT_TS_KEY);
        if (active) setSessionRecoveryLinks(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setError("");
    setSessionRecoveryLinks(false);
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
      window.sessionStorage.removeItem("bpvp_auth_redirect_ts");
      window.location.href = "/market";
    } finally {
      setSigningIn(false);
    }
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
        {sessionRecoveryLinks ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href="/market"
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
            >
              {isSpanish ? "Abrir /market" : "Open /market"}
            </a>
            <a
              href="/login?force=1"
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
            >
              {isSpanish ? "Quedarse en login (?force=1)" : "Stay on login (?force=1)"}
            </a>
          </div>
        ) : null}
        {info ? <p className="mt-2 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-emerald-300">{info}</p> : null}
      </div>
    </main>
  );
}
