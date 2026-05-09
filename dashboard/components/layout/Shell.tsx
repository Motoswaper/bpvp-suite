import { ReactNode } from "react";
import { ClearLoginRedirectMarkers } from "@/components/auth/ClearLoginRedirectMarkers";
import { Sidebar } from "@/components/layout/Sidebar";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-bpvp-page text-bpvp-ink">
      <ClearLoginRedirectMarkers />
      <Sidebar />
      <main className="min-h-screen border-l border-bpvp-border bg-bpvp-page p-6">{children}</main>
    </div>
  );
}
