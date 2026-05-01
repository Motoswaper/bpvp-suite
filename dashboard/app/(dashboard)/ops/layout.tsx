import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionFromServerCookies } from "@/lib/auth";

export default async function OpsLayout({ children }: { children: ReactNode }) {
  const session = await getSessionFromServerCookies();
  if (!session || session.role !== "admin") {
    redirect("/");
  }
  return <>{children}</>;
}
