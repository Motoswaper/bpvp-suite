"use client";

import { useCallback, useEffect, useState } from "react";

export function useEngineModuleState<T>(module: string, pollMs = 10000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const path = `/state/${module}`;
      const res = await fetch(`/api/engine?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setData(json as T);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  return { data, error, loading, refresh };
}
