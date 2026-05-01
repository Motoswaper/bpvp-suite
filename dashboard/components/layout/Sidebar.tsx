import Link from "next/link";
import { Menu } from "@/components/navigation/Menu";

export function Sidebar() {
  return (
    <aside className="border-r border-slate-800 p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <Link href="/" className="mb-6 block rounded-md border border-slate-800 bg-slate-950/50 p-2">
        <img
          src="/brand/bpvp-suite-logo-final.png"
          alt="BPVP Suite logo"
          className="h-20 w-full object-contain"
        />
      </Link>
      <div className="flex min-h-[calc(100vh-10rem)] flex-col">
        <Menu />
        <div className="mt-auto pt-4">
          <div className="rounded-md border border-slate-700 bg-[#101523]/90 px-3 py-2 text-center text-xs leading-5 text-slate-300">
            <p className="animate-pulse text-sm font-extrabold tracking-wide text-white [text-shadow:0_0_12px_rgba(56,189,248,0.45)]">
              BPVP
            </p>
            <p className="font-semibold">Bitcoin Protocol</p>
            <p className="font-semibold">Value Protocol</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
