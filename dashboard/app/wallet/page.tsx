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

function workflowRunsUrl(repo: string) {
  return `https://github.com/${repo}/actions/workflows/bpvp-wallet-release.yml`;
}

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type ReleasePayload = {
  html_url: string;
  assets: ReleaseAsset[];
};

async function fetchRelease(repo: string, tag: string): Promise<ReleasePayload | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ReleasePayload;
    if (!json || !Array.isArray(json.assets)) return null;
    return json;
  } catch {
    return null;
  }
}

function assetUrl(assets: ReleaseAsset[], fileName: string): string | null {
  const match = assets.find((item) => item.name === fileName);
  return match?.browser_download_url ?? null;
}

export default async function WalletPage() {
  const store = await cookies();
  const isSpanish = String(store.get("bpvp_locale")?.value ?? "").toLowerCase() === "es";

  const repo = process.env.NEXT_PUBLIC_BPVP_WALLET_REPO?.trim() || DEFAULT_REPO;
  const tag = process.env.NEXT_PUBLIC_BPVP_WALLET_TAG?.trim() || DEFAULT_TAG;
  const release = await fetchRelease(repo, tag);
  const releaseUrl = release?.html_url || releasePageUrl(repo, tag);
  const assets = release?.assets ?? [];
  const links = {
    macDmg: assetUrl(assets, INSTALLERS.macDmg),
    macZip: assetUrl(assets, INSTALLERS.macZip),
    winSetup: assetUrl(assets, INSTALLERS.winSetup),
    winPortable: assetUrl(assets, INSTALLERS.winPortable),
    linuxAppImage: assetUrl(assets, INSTALLERS.linuxAppImage),
    linuxDeb: assetUrl(assets, INSTALLERS.linuxDeb),
    checksums: assetUrl(assets, INSTALLERS.checksums),
  } as const;
  const hasAnyInstaller = Object.values(links).some(Boolean);

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
          {!hasAnyInstaller ? (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              {isSpanish
                ? "Aun no hay assets publicados para este tag. Usa el workflow de release y vuelve a intentar."
                : "No published assets found for this tag yet. Run the wallet release workflow and try again."}{" "}
              <a className="underline hover:text-amber-100" href={workflowRunsUrl(repo)} rel="noopener noreferrer" target="_blank">
                {isSpanish ? "Abrir workflow" : "Open workflow"}
              </a>
            </p>
          ) : null}
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
                {links.macDmg ? (
                  <a href={links.macDmg} className="font-medium text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
                    {isSpanish ? "Descargar .dmg" : "Download .dmg"}
                  </a>
                ) : (
                  <span className="text-slate-500">{isSpanish ? ".dmg pendiente de publicar" : ".dmg not published yet"}</span>
                )}
              </li>
              <li>
                {links.macZip ? (
                  <a href={links.macZip} className="font-medium text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
                    {isSpanish ? "Descargar .zip" : "Download .zip"}
                  </a>
                ) : (
                  <span className="text-slate-500">{isSpanish ? ".zip pendiente de publicar" : ".zip not published yet"}</span>
                )}
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
                {links.winSetup ? (
                  <a href={links.winSetup} className="font-medium text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
                    {isSpanish ? "Descargar instalador (Setup)" : "Download installer (Setup)"}
                  </a>
                ) : (
                  <span className="text-slate-500">{isSpanish ? "Setup pendiente de publicar" : "Setup not published yet"}</span>
                )}
              </li>
              <li>
                {links.winPortable ? (
                  <a href={links.winPortable} className="font-medium text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
                    {isSpanish ? "Descargar portable .exe" : "Download portable .exe"}
                  </a>
                ) : (
                  <span className="text-slate-500">{isSpanish ? "Portable pendiente de publicar" : "Portable not published yet"}</span>
                )}
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
                {links.linuxAppImage ? (
                  <a href={links.linuxAppImage} className="font-medium text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
                    {isSpanish ? "Descargar AppImage" : "Download AppImage"}
                  </a>
                ) : (
                  <span className="text-slate-500">{isSpanish ? "AppImage pendiente de publicar" : "AppImage not published yet"}</span>
                )}
              </li>
              <li>
                {links.linuxDeb ? (
                  <a href={links.linuxDeb} className="font-medium text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
                    {isSpanish ? "Descargar .deb" : "Download .deb"}
                  </a>
                ) : (
                  <span className="text-slate-500">{isSpanish ? ".deb pendiente de publicar" : ".deb not published yet"}</span>
                )}
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
            {links.checksums ? (
              <a href={links.checksums} className="text-cyan-300 hover:text-cyan-200" rel="noopener noreferrer" target="_blank">
                checksums.txt
              </a>
            ) : (
              <span className="text-slate-500">checksums.txt {isSpanish ? "pendiente de publicar" : "not published yet"}</span>
            )}
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
