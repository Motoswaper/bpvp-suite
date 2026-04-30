import { cookies } from "next/headers";

export default async function WalletPage() {
  const store = await cookies();
  const isSpanish = String(store.get("bpvp_locale")?.value ?? "").toLowerCase() === "es";

  return (
    <main className="min-h-screen bg-[#0b0f18] px-6 py-12 text-slate-100">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="rounded-xl border border-slate-800 bg-[#101523] p-5">
          <h1 className="text-2xl font-semibold">
            {isSpanish ? "BPVP Wallet (Signet/Testnet)" : "BPVP Wallet (Signet/Testnet)"}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {isSpanish
              ? "Portal oficial de descarga y pruebas de wallet BPVP para entornos de prueba Bitcoin. Diseñado para validar operaciones sin tocar mainnet ni usar activos reales."
              : "Official BPVP wallet download and testing portal for Bitcoin test environments. Built to validate operations without touching mainnet or using real assets."}
          </p>
        </header>

        <section className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-sm text-cyan-100">
          <p className="font-semibold">
            {isSpanish ? "Modo seguro activo: solo Signet/Testnet" : "Safe mode active: Signet/Testnet only"}
          </p>
          <p className="mt-1 text-cyan-200">
            {isSpanish
              ? "Nunca uses fondos reales en este entorno. Este flujo está limitado a pruebas controladas."
              : "Never use real funds in this environment. This flow is restricted to controlled testing."}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <a
            href="/downloads/BPVP-Wallet-Signet-Setup-macOS.txt"
            className="rounded-xl border border-slate-800 bg-[#101523] p-4 hover:bg-slate-900/70"
          >
            <p className="text-sm font-semibold">macOS</p>
            <p className="mt-1 text-xs text-slate-400">
              {isSpanish ? "Descargar guía de instalación" : "Download installation guide"}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              /downloads/BPVP-Wallet-Signet-Setup-macOS.txt
            </p>
          </a>
          <a
            href="/downloads/BPVP-Wallet-Signet-Setup-Windows.txt"
            className="rounded-xl border border-slate-800 bg-[#101523] p-4 hover:bg-slate-900/70"
          >
            <p className="text-sm font-semibold">Windows</p>
            <p className="mt-1 text-xs text-slate-400">
              {isSpanish ? "Descargar guía de instalación" : "Download installation guide"}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              /downloads/BPVP-Wallet-Signet-Setup-Windows.txt
            </p>
          </a>
          <a
            href="/downloads/BPVP-Wallet-Signet-Setup-Linux.txt"
            className="rounded-xl border border-slate-800 bg-[#101523] p-4 hover:bg-slate-900/70"
          >
            <p className="text-sm font-semibold">Linux</p>
            <p className="mt-1 text-xs text-slate-400">
              {isSpanish ? "Descargar guía de instalación" : "Download installation guide"}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              /downloads/BPVP-Wallet-Signet-Setup-Linux.txt
            </p>
          </a>
        </section>
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-100">
          {isSpanish
            ? "Estado actual: publicamos guías de instalación y flujo seguro de pruebas. Los instaladores firmados (.exe/.dmg/AppImage) se publican por release versionada."
            : "Current status: installation guides and secure testing flow are published. Signed installers (.exe/.dmg/AppImage) are published via versioned releases."}
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#101523] p-5">
          <h2 className="text-base font-semibold">{isSpanish ? "Cómo probar correctamente" : "How to test correctly"}</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>{isSpanish ? "Instala BPVP Wallet beta para Signet/Testnet." : "Install BPVP Wallet beta for Signet/Testnet."}</li>
            <li>{isSpanish ? "Crea una wallet nueva exclusiva de pruebas." : "Create a new test-only wallet."}</li>
            <li>{isSpanish ? "Solicita fondos de prueba en faucet Signet/Testnet." : "Request test funds from Signet/Testnet faucet."}</li>
            <li>{isSpanish ? "Conecta la wallet desde Profile en BPVP Suite." : "Connect wallet from Profile in BPVP Suite."}</li>
            <li>{isSpanish ? "Ejecuta pruebas de módulos con montos bajos y evidencia." : "Run module tests with low amounts and evidence."}</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
