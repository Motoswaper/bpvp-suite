import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <Sidebar />
      <main className="p-6">{children}</main>
    </div>
  );
}
