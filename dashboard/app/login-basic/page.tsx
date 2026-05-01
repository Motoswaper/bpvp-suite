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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070f] px-4">
      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-800 bg-[#101523] p-6">
          <img
            src="/brand/bpvp-suite-logo.svg"
            alt="BPVP Suite logo"
            className="h-auto w-full rounded-md border border-slate-800 bg-slate-950/50 p-2"
          />
          <h1 className="text-xl font-semibold">
            {isSpanish ? "Inicia sesion (modo compatible)" : "Sign in (compatibility mode)"}
          </h1>
          <p className="text-xs text-slate-400">
            {isSpanish
              ? "Usa este bloque solo si YA tienes usuario y password."
              : "Use this block only if you ALREADY have username and password."}
          </p>
          <form action="/api/auth/login?redirect=1" method="post" className="space-y-3">
            <input
              name="username"
              type="text"
              placeholder={isSpanish ? "Usuario (ej. tester-7gk2p4)" : "Username (e.g. tester-7gk2p4)"}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              required
            />
            <input
              name="password"
              type="password"
              placeholder={isSpanish ? "Password (ej. A9v!kP2#tQ)" : "Password (e.g. A9v!kP2#tQ)"}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              required
            />
            <input
              name="otp"
              type="text"
              placeholder={isSpanish ? "OTP (opcional) ej. 483920" : "OTP (optional) e.g. 483920"}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
            >
              {isSpanish ? "Iniciar sesion" : "Sign in"}
            </button>
          </form>
          {loginError ? (
            <p className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">
              {loginError}
            </p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-[#101523] p-6">
          <h2 className="text-xl font-semibold">
            {isSpanish ? "Crear cuenta de prueba" : "Create test account"}
          </h2>
          <p className="text-xs text-slate-400">
            {isSpanish
              ? "Este es el registro para usuarios nuevos: crea cuenta e inicia sesion automaticamente."
              : "This is registration for new users: it creates an account and signs in automatically."}
          </p>
          <form action="/api/auth/register?redirect=1" method="post">
            <button
              type="submit"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              {isSpanish ? "Entrar como invitado de prueba" : "Enter as test guest"}
            </button>
          </form>
          {registerError ? (
            <p className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">
              {registerError}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

