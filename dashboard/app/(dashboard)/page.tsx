"use client";
import { Navbar } from "@/components/layout/Navbar";
import { KpiCard } from "@/components/cards/KpiCard";
import { useEngine } from "@/hooks/useEngine";
import { useIndexer } from "@/hooks/useIndexer";
import { useWatcher } from "@/hooks/useWatcher";
export default function DashboardPage(){const engine=useEngine(); const indexer=useIndexer(); const watcher=useWatcher(); return <section className="space-y-4"><Navbar title="Overview" /><div className="grid gap-4 md:grid-cols-3"><KpiCard label="Engine Height" value={engine.data?.engine?.height ?? "-"} /><KpiCard label="Indexer Height" value={indexer.data?.indexer?.height ?? "-"} /><KpiCard label="Watcher Synced" value={watcher.data?.watcher?.lastSyncedHeight ?? "-"} /></div></section>;}
