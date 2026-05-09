import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Menu } from "@/components/navigation/Menu";

export function Sidebar() {
  return (
    <aside className="border-r border-bpvp-border bg-bpvp-card p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <Link href="/" className="mb-6 block rounded-md border border-bpvp-border bg-bpvp-input p-2">
        <BrandLogo variant="sidebar" alt="BPVP Suite logo" />
      </Link>
      <div className="flex min-h-[calc(100vh-10rem)] flex-col">
        <Menu />
        <div className="mt-auto pt-4">
          <div className="rounded-md border border-bpvp-border bg-bpvp-input/90 px-3 py-2 text-center text-xs leading-5 text-bpvp-muted">
            <p className="animate-pulse text-sm font-extrabold tracking-wide text-bpvp-ink [text-shadow:0_0_12px_rgba(56,189,248,0.35)] dark:text-white">
              BPVP
            </p>
            <p className="font-semibold text-bpvp-ink">Bitcoin Protocol</p>
            <p className="font-semibold text-bpvp-ink">Value Protocol</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
