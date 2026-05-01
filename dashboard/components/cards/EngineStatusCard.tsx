"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

type EngineStatus = {
  engine?: { height?: number; version?: string; modules?: string[]; stateHash?: string };
};

export function EngineStatusCard() {
  const [st, setSt] = useState<EngineStatus | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/engine?path=/status", { cache: "no-store" });
        const j = (await res.json()) as EngineStatus & { error?: string };
        if (stop) return;
        if (!res.ok) {
          setErr(j?.error || `HTTP ${res.status}`);
          setSt(null);
        } else {
          setSt(j);
          setErr("");
        }
      } catch (e) {
        if (!stop) setErr(String(e));
      }
    })();
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/engine?path=/status", { cache: "no-store" });
        const j = (await res.json()) as EngineStatus;
        if (!stop && res.ok) setSt(j);
      } catch {
        /* keep last */
      }
    }, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return (
    <Card title="Engine (live)">
      {err ? <p className="text-sm text-rose-300">{err}</p> : null}
      {st?.engine ? (
        <ul className="text-sm text-slate-300">
          <li>
            <span className="text-slate-500">Version:</span> {st.engine.version ?? "—"}
          </li>
          <li>
            <span className="text-slate-500">Height:</span> {st.engine.height ?? "—"}
          </li>
          <li>
            <span className="text-slate-500">State hash:</span>{" "}
            <span className="font-mono text-[10px] text-slate-400">{st.engine.stateHash ? `${st.engine.stateHash.slice(0, 16)}…` : "—"}</span>
          </li>
          <li>
            <span className="text-slate-500">Modules:</span>{" "}
            <span className="font-mono text-xs text-slate-400">{(st.engine.modules ?? []).join(", ") || "—"}</span>
          </li>
        </ul>
      ) : !err ? (
        <p className="text-sm text-slate-400">Loading engine status…</p>
      ) : null}
    </Card>
  );
}
