import { cookies } from "next/headers";

const DEFAULT_REPO = "Motoswaper/bpvp-suite";
const DEFAULT_TAG = "bpvp-wallet-v0.1.2";

/** electron-builder artifact names for v0.1.0 (CI: mac arm64, win x64, linux x64). */
const INSTALLERS = {
  macDmg: "BPVP Wallet-0.1.0-arm64.dmg",
  macZip: "BPVP Wallet-0.1.0-arm64-mac.zip",
  winSetup: "BPVP Wallet Setup 0.1.0.exe",
  winPortable: "BPVP Wallet 0.1.0.exe",
  linuxAppImage: "BPVP Wallet-0.1.0-x86_64.AppImage",
  linuxDeb: "bpvp-wallet_0.1.0_amd64.deb",
  checksums: "checksums.txt",
} as const;

function releasePageUrl(repo: string, tag: string) {
  return `https://github.com/${repo}/releases/tag/${tag}`;
}

function downloadUrl(repo: string, tag: string, fileName: string) {
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

export default async function WalletPage() {
  const store = await cookies();
  const isSpanish = String(store.get("bpvp_locale")?.value ?? "").toLowerCase() === "es";

  const repo = process.env.NEXT_PUBLIC_BPVP_WALLET_REPO?.trim() || DEFAULT_REPO;
  const tag = process.env.NEXT_PUBLIC_BPVP_WALLET_TAG?.trim() || DEFAULT_TAG;
  const releaseUrl = releasePageUrl(repo, tag);

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
          <p className="mt-3">
            <a
              href={releaseUrl}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-600/50 bg-cyan-950/40 px-3 py-2 text-sm font-medium text-cyan-100 hover:border-cyan-500 hover:bg-cyan-950/60"
              rel="noopener noreferrer"
              target="_blank"
            >
              {isSpanish ? "Abrir release en GitHub (Assets + checksums)" : "Open GitHub release (assets + checksums)"}
            </a>
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
          <div className="rounded-xl border border-slate-800 bg-[#101523] p-4">
            <p className="text-sm font-semibold">macOS</p>
            <p className="mt-1 text-xs text-slate-400">
              {isSpanish ? "Apple Silicon (arm64) — DMG y ZIP desde la release." : "Apple Silicon (arm64) — DMG and ZIP from the release."}
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a
                  href={downloadUrl(repo, tag, INSTALLERS.macDmg)}
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {isSpanish ? "Descargar .dmg" : "Download .dmg"}
                </a>
              </li>
              <li>
                <a
                  href={downloadUrl(repo, tag, INSTALLERS.macZip)}
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {isSpanish ? "Descargar .zip" : "Download .zip"}
                </a>
              </li>
              <li>
                <a
                  href="/downloads/BPVP-Wallet-Signet-Setup-macOS.txt"
                  className="text-slate-400 underline hover:text-slate-300"
                >
                  {isSpanish ? "Guía de instalación (local)" : "Setup guide (local)"}
                </a>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#101523] p-4">
            <p className="text-sm font-semibold">Windows</p>
            <p className="mt-1 text-xs text-slate-400">
              {isSpanish ? "Instalador NSIS y portable .exe." : "NSIS installer and portable .exe."}
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a
                  href={downloadUrl(repo, tag, INSTALLERS.winSetup)}
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {isSpanish ? "Descargar instalador (Setup)" : "Download installer (Setup)"}
                </a>
              </li>
              <li>
                <a
                  href={downloadUrl(repo, tag, INSTALLERS.winPortable)}
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {isSpanish ? "Descargar portable .exe" : "Download portable .exe"}
                </a>
              </li>
              <li>
                <a
                  href="/downloads/BPVP-Wallet-Signet-Setup-Windows.txt"
                  className="text-slate-400 underline hover:text-slate-300"
                >
                  {isSpanish ? "Guía de instalación (local)" : "Setup guide (local)"}
                </a>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#101523] p-4">
            <p className="text-sm font-semibold">Linux</p>
            <p className="mt-1 text-xs text-slate-400">
              {isSpanish ? "AppImage y paquete .deb (amd64)." : "AppImage and .deb package (amd64)."}
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a
                  href={downloadUrl(repo, tag, INSTALLERS.linuxAppImage)}
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {isSpanish ? "Descargar AppImage" : "Download AppImage"}
                </a>
              </li>
              <li>
                <a
                  href={downloadUrl(repo, tag, INSTALLERS.linuxDeb)}
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {isSpanish ? "Descargar .deb" : "Download .deb"}
                </a>
              </li>
              <li>
                <a
                  href="/downloads/BPVP-Wallet-Signet-Setup-Linux.txt"
                  className="text-slate-400 underline hover:text-slate-300"
                >
                  {isSpanish ? "Guía de instalación (local)" : "Setup guide (local)"}
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-[#101523] p-4 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">
            {isSpanish ? "Verificación SHA256" : "SHA256 verification"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {isSpanish
              ? "Descarga checksums.txt desde la misma release y compara el hash del instalador antes de abrirlo."
              : "Download checksums.txt from the same release and compare the installer hash before opening it."}
          </p>
          <p className="mt-2">
            <a
              href={downloadUrl(repo, tag, INSTALLERS.checksums)}
              className="text-cyan-300 hover:text-cyan-200"
              rel="noopener noreferrer"
              target="_blank"
            >
              checksums.txt
            </a>
            <span className="mx-2 text-slate-600">·</span>
            <a href={releaseUrl} className="text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
              {isSpanish ? "Todos los assets" : "All assets"}
            </a>
          </p>
        </section>

        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-100">
          {isSpanish
            ? "Si un enlace directo devuelve 404, el nombre del archivo en GitHub puede variar según el runner; usa «Abrir release en GitHub» y elige el asset correcto en Assets."
            : "If a direct link returns 404, the exact filename on GitHub may differ by runner; use “Open GitHub release” and pick the matching file under Assets."}
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
