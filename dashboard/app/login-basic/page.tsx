import Link from "next/link";
import { cookies } from "next/headers";

export default async function LoginBasicPage({
  searchParams
}: {
  searchParams?: { loginError?: string; registerError?: string };
}) {
  const store = await cookies();
  const isSpanish = String(store.get("bpvp_locale")?.value ?? "").toLowerCase() === "es";
  const loginError = searchParams?.loginError ? String(searchParams.loginError) : "";
  const registerError = searchParams?.registerError ? String(searchParams.registerError) : "";
  const homeHref = isSpanish ? "/?lang=es" : "/?lang=en";
  const loginJsonHref = isSpanish ? "/login?lang=es" : "/login?lang=en";

  return (
    <main className="flex min-h-screen flex-col bg-bpvp-page text-bpvp-ink">
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-wrap items-center justify-between gap-3 px-4 pt-6 pb-2">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-2 rounded-lg border-2 border-orange-500/50 bg-bpvp-card px-4 py-2.5 text-sm font-semibold text-bpvp-ink shadow-sm hover:bg-bpvp-hover"
        >
          <span aria-hidden className="text-lg">
            ←
          </span>
          {isSpanish ? "Volver al inicio" : "Back to home"}
        </Link>
        <Link href={loginJsonHref} className="text-xs font-medium text-bpvp-muted underline-offset-4 hover:text-bpvp-ink hover:underline">
          {isSpanish ? "Login estandar (SPA)" : "Standard login (SPA)"}
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-bpvp-border bg-bpvp-card p-6 shadow-sm">
          <img
            src="/brand/bitcoin-corner-photo.jpg"
            alt="BPVP Suite logo"
            width={280}
            height={160}
            className="mx-auto h-auto max-h-52 w-full max-w-[280px] rounded-xl border-2 border-orange-400/50 bg-bpvp-input object-contain p-2 shadow-md"
          />
          <h1 className="text-xl font-semibold">
            {isSpanish ? "Inicia sesion (modo compatible)" : "Sign in (compatibility mode)"}
          </h1>
          <p className="text-xs text-bpvp-muted">
            {isSpanish
              ? "Usa este bloque solo si YA tienes usuario y password."
              : "Use this block only if you ALREADY have username and password."}
          </p>
          <form action="/api/auth/login?redirect=1" method="post" className="space-y-3">
            <input
              name="username"
              type="text"
              placeholder={isSpanish ? "Usuario (ej. tester-7gk2p4)" : "Username (e.g. tester-7gk2p4)"}
              className="w-full rounded-md border border-bpvp-border bg-bpvp-input px-3 py-2 text-sm text-bpvp-ink placeholder:text-bpvp-faint"
              required
            />
            <input
              name="password"
              type="password"
              placeholder={isSpanish ? "Password (ej. A9v!kP2#tQ)" : "Password (e.g. A9v!kP2#tQ)"}
              className="w-full rounded-md border border-bpvp-border bg-bpvp-input px-3 py-2 text-sm text-bpvp-ink placeholder:text-bpvp-faint"
              required
            />
            <input
              name="otp"
              type="text"
              placeholder={isSpanish ? "OTP (opcional) ej. 483920" : "OTP (optional) e.g. 483920"}
              className="w-full rounded-md border border-bpvp-border bg-bpvp-input px-3 py-2 text-sm text-bpvp-ink placeholder:text-bpvp-faint"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              {isSpanish ? "Iniciar sesion" : "Sign in"}
            </button>
          </form>
          {loginError ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">{loginError}</p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-bpvp-border bg-bpvp-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            {isSpanish ? "Crear cuenta de prueba" : "Create test account"}
          </h2>
          <p className="text-xs text-bpvp-muted">
            {isSpanish
              ? "Este es el registro para usuarios nuevos: crea cuenta e inicia sesion automaticamente."
              : "This is registration for new users: it creates an account and signs in automatically."}
          </p>
          <form action="/api/auth/register?redirect=1" method="post">
            <button
              type="submit"
              className="w-full rounded-md border border-emerald-600/50 bg-emerald-600/15 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-600/25 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
            >
              {isSpanish ? "Entrar como invitado de prueba" : "Enter as test guest"}
            </button>
          </form>
          {registerError ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">{registerError}</p>
          ) : null}
        </section>
      </div>
      </div>
    </main>
  );
}

