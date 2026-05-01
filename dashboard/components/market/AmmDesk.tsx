"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

type AMMState = {
  enabled?: boolean;
  token0?: string;
  token1?: string;
  reserve0?: number;
  reserve1?: number;
  feeBps?: number;
  totalLiquidity?: number;
  positions?: Record<string, number>;
  volumeToken0?: number;
  volumeToken1?: number;
  swapCount?: number;
  lastPriceToken1?: number;
  updatedAt?: string;
  policy?: {
    maxPriceImpactBps?: number;
    maxSwapInRatioBps?: number;
    twapWindowSeconds?: number;
    twapMaxDeviationBps?: number;
    circuitBreakerEnabled?: boolean;
    circuitBreakerCooldownSec?: number;
  };
  guardrails?: {
    circuitBreakerTripped?: boolean;
    circuitBreakerReason?: string;
    circuitBreakerTrippedAt?: string;
    lastPriceImpactBps?: number;
    lastTwapPrice?: number;
    lastDeviationBps?: number;
  };
  traderLimits?: Record<string, { maxNotionalPerWindowToken0?: number; windowSeconds?: number }>;
  traderStats?: Record<string, { windowStartTs?: number; windowUsedToken0?: number; totalSwaps?: number }>;
  recentExecutions?: Array<{
    ts?: number;
    trader?: string;
    tokenIn?: string;
    amountIn?: number;
    amountOut?: number;
    priceImpactBps?: number;
    twapDeviationBps?: number;
    status?: string;
    reason?: string;
  }>;
};

type MarketState = {
  trades?: string[];
  amm?: AMMState;
};

type AuditSnapshot = {
  ok?: boolean;
  audit?: {
    generatedAt?: string;
    ok?: boolean;
    checks?: Record<string, boolean>;
  };
  signature?: string;
};

const asNum = (v: unknown) => (typeof v === "number" ? v : 0);

export function AmmDesk() {
  const [state, setState] = useState<MarketState | null>(null);
  const [status, setStatus] = useState("idle");
  const [provider, setProvider] = useState("desk-alpha");
  const [amount0, setAmount0] = useState("1");
  const [amount1, setAmount1] = useState("1000");
  const [tokenIn, setTokenIn] = useState("BTC");
  const [amountIn, setAmountIn] = useState("0.1");
  const [minAmountOut, setMinAmountOut] = useState("0");
  const [liquidity, setLiquidity] = useState("1");
  const [maxPriceImpactBps, setMaxPriceImpactBps] = useState("1200");
  const [maxSwapInRatioBps, setMaxSwapInRatioBps] = useState("1500");
  const [twapWindowSeconds, setTwapWindowSeconds] = useState("300");
  const [twapMaxDeviationBps, setTwapMaxDeviationBps] = useState("1800");
  const [cooldownSec, setCooldownSec] = useState("180");
  const [limitNotional, setLimitNotional] = useState("1.5");
  const [limitWindowSec, setLimitWindowSec] = useState("60");
  const [opsToken, setOpsToken] = useState("");
  const [audit, setAudit] = useState<AuditSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/market/amm/state", { cache: "no-store" });
    const data = await res.json();
    setState(data);
  }, []);

  const refreshAudit = useCallback(async () => {
    const res = await fetch("/api/market/amm/audit/latest", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setAudit(data as AuditSnapshot);
      return;
    }
    setAudit(null);
  }, []);

  const runAction = useCallback(
    async (type: string, data: Record<string, unknown>) => {
      setStatus(`running ${type}...`);
      const headers: Record<string, string> = { "content-type": "application/json" };
      const sensitive = new Set(["amm_set_policy", "amm_reset_circuit_breaker", "amm_set_trader_limit"]);
      if (sensitive.has(type) && opsToken) {
        headers["x-bpvp-ops-token"] = opsToken;
      }
      const res = await fetch("/api/market/amm/action", {
        method: "POST",
        headers,
        body: JSON.stringify({ type, data })
      });
      const raw = await res.json();
      if (!res.ok) {
        setStatus(`error: ${raw?.error ?? "failed action"}`);
        return;
      }
      await refresh();
      setStatus(`${type}: ok`);
    },
    [opsToken, refresh]
  );

  const amm = state?.amm ?? {};
  const guardrails = amm.guardrails ?? {};
  const policy = amm.policy ?? {};
  const traderStats = amm.traderStats ?? {};
  const traderLimits = amm.traderLimits ?? {};
  const meStats = traderStats[provider] ?? {};
  const meLimit = traderLimits[provider] ?? {};
  const token0 = amm.token0 ?? "BTC";
  const token1 = amm.token1 ?? "BPVP";
  const quoteOut = useMemo(() => {
    const reserve0 = asNum(amm.reserve0);
    const reserve1 = asNum(amm.reserve1);
    const inAmount = Number(amountIn) || 0;
    const feeBps = asNum(amm.feeBps) || 30;
    if (!reserve0 || !reserve1 || inAmount <= 0) return 0;
    const feeFactor = (10000 - feeBps) / 10000;
    const inAfterFee = inAmount * feeFactor;
    if (tokenIn === token0) {
      return (reserve1 * inAfterFee) / (reserve0 + inAfterFee);
    }
    return (reserve0 * inAfterFee) / (reserve1 + inAfterFee);
  }, [amm.feeBps, amm.reserve0, amm.reserve1, amountIn, token0, token1, tokenIn]);

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Pool" value={`${token0}/${token1}`} />
        <Metric label="Reserves" value={`${asNum(amm.reserve0).toFixed(4)} / ${asNum(amm.reserve1).toFixed(4)}`} />
        <Metric label="LP Supply" value={asNum(amm.totalLiquidity).toFixed(4)} />
        <Metric label="Swaps" value={`${asNum(amm.swapCount)}`} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Circuit Breaker" value={guardrails.circuitBreakerTripped ? "TRIPPED" : "OK"} />
        <Metric label="Price Impact (bps)" value={asNum(guardrails.lastPriceImpactBps).toFixed(2)} />
        <Metric label="TWAP Deviation (bps)" value={asNum(guardrails.lastDeviationBps).toFixed(2)} />
        <Metric label="TWAP Price" value={asNum(guardrails.lastTwapPrice).toFixed(6)} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="My Limit (token0)" value={asNum(meLimit.maxNotionalPerWindowToken0).toFixed(4)} />
        <Metric label="My Window (sec)" value={`${asNum(meLimit.windowSeconds)}`} />
        <Metric label="My Used (token0)" value={asNum(meStats.windowUsedToken0).toFixed(4)} />
        <Metric label="My Total Swaps" value={`${asNum(meStats.totalSwaps)}`} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="font-semibold text-slate-200">Auto Audit</p>
          <p className="mt-1 text-xs text-slate-400">Status: {audit?.audit?.ok ? "PASS" : "UNKNOWN/FAIL"}</p>
          <p className="text-xs text-slate-500">Generated: {audit?.audit?.generatedAt ?? "-"}</p>
          <p className="text-xs text-slate-500">Signature: {audit?.signature ? `${audit.signature.slice(0, 16)}...` : "-"}</p>
          <button onClick={refreshAudit} className="mt-2 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700">
            Refresh audit
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ActionBox
          title="Init Pool"
          onClick={() =>
            runAction("amm_init_pool", {
              token0,
              token1,
              amount0: Number(amount0),
              amount1: Number(amount1),
              provider
            })
          }
        >
          <Inputs provider={provider} setProvider={setProvider} amount0={amount0} setAmount0={setAmount0} amount1={amount1} setAmount1={setAmount1} token0={token0} token1={token1} />
        </ActionBox>
        <ActionBox
          title="Add Liquidity"
          onClick={() =>
            runAction("amm_add_liquidity", {
              amount0: Number(amount0),
              amount1: Number(amount1),
              provider
            })
          }
        >
          <Inputs provider={provider} setProvider={setProvider} amount0={amount0} setAmount0={setAmount0} amount1={amount1} setAmount1={setAmount1} token0={token0} token1={token1} />
        </ActionBox>
        <ActionBox
          title="Remove Liquidity"
          onClick={() =>
            runAction("amm_remove_liquidity", {
              provider,
              liquidity: Number(liquidity)
            })
          }
        >
          <label className="block space-y-1">
            <span className="text-slate-400">Provider</span>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">Liquidity</span>
            <input value={liquidity} onChange={(e) => setLiquidity(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
          </label>
        </ActionBox>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ActionBox
          title="Policy Controls"
          onClick={() =>
            runAction("amm_set_policy", {
              maxPriceImpactBps: Number(maxPriceImpactBps),
              maxSwapInRatioBps: Number(maxSwapInRatioBps),
              twapWindowSeconds: Number(twapWindowSeconds),
              twapMaxDeviationBps: Number(twapMaxDeviationBps),
              circuitBreakerEnabled: true,
              circuitBreakerCooldownSec: Number(cooldownSec)
            })
          }
        >
          <PolicyInputs label="Max Price Impact (bps)" value={maxPriceImpactBps} onChange={setMaxPriceImpactBps} />
          <PolicyInputs label="Max Swap In Ratio (bps)" value={maxSwapInRatioBps} onChange={setMaxSwapInRatioBps} />
          <PolicyInputs label="TWAP Window (sec)" value={twapWindowSeconds} onChange={setTwapWindowSeconds} />
          <PolicyInputs label="TWAP Max Deviation (bps)" value={twapMaxDeviationBps} onChange={setTwapMaxDeviationBps} />
          <PolicyInputs label="Breaker Cooldown (sec)" value={cooldownSec} onChange={setCooldownSec} />
        </ActionBox>
        <ActionBox title="Circuit Breaker Ops" onClick={() => runAction("amm_reset_circuit_breaker", {})}>
          <p className="text-xs text-slate-400">
            Reason: {guardrails.circuitBreakerReason ?? "-"}
          </p>
          <p className="text-xs text-slate-500">
            Tripped at: {guardrails.circuitBreakerTrippedAt ?? "-"}
          </p>
          <p className="text-xs text-slate-500">
            Active policy: impact&lt;={asNum(policy.maxPriceImpactBps)}, swapRatio&lt;={asNum(policy.maxSwapInRatioBps)}, twapDev&lt;={asNum(policy.twapMaxDeviationBps)}
          </p>
        </ActionBox>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="font-semibold text-slate-200">Ops Security Token</p>
          <label className="mt-2 block space-y-1">
            <span className="text-slate-400">Required for sensitive actions if server enforces it</span>
            <input type="password" value={opsToken} onChange={(e) => setOpsToken(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
          </label>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ActionBox
          title="Trader Risk Limits"
          onClick={() =>
            runAction("amm_set_trader_limit", {
              trader: provider,
              maxNotionalPerWindowToken0: Number(limitNotional),
              windowSeconds: Number(limitWindowSec)
            })
          }
        >
          <PolicyInputs label="Max Notional / Window (token0)" value={limitNotional} onChange={setLimitNotional} />
          <PolicyInputs label="Window Seconds" value={limitWindowSec} onChange={setLimitWindowSec} />
        </ActionBox>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="font-semibold text-slate-200">Recent Executions</p>
          <p className="text-xs text-slate-500">count: {amm.recentExecutions?.length ?? 0}</p>
          <div className="mt-2 max-h-44 space-y-1 overflow-auto text-xs text-slate-400">
            {(amm.recentExecutions ?? []).slice(-8).reverse().map((x, i) => (
              <p key={`${x.ts}-${i}`}>
                {x.status ?? "-"} {x.trader ?? "-"} {x.tokenIn ?? "-"} in:{asNum(x.amountIn).toFixed(4)} out:{asNum(x.amountOut).toFixed(4)} reason:{x.reason ?? "-"}
              </p>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ActionBox
          title="Swap Exact In"
          onClick={() =>
            runAction("amm_swap_exact_in", {
              trader: provider,
              tokenIn,
              amountIn: Number(amountIn),
              minAmountOut: Number(minAmountOut)
            })
          }
        >
          <label className="block space-y-1">
            <span className="text-slate-400">Token In</span>
            <select value={tokenIn} onChange={(e) => setTokenIn(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1">
              <option value={token0}>{token0}</option>
              <option value={token1}>{token1}</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">Amount In</span>
            <input value={amountIn} onChange={(e) => setAmountIn(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">Min Amount Out</span>
            <input value={minAmountOut} onChange={(e) => setMinAmountOut(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
          </label>
          <p className="text-xs text-emerald-300">Quote out: {quoteOut.toFixed(6)}</p>
        </ActionBox>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="font-semibold text-slate-200">Desk Status</p>
          <p className="mt-2 text-xs text-slate-400">{status}</p>
          <button onClick={refresh} className="mt-3 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700">
            Refresh state
          </button>
          <button onClick={refreshAudit} className="ml-2 mt-3 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700">
            Refresh audit
          </button>
          <p className="mt-3 text-xs text-slate-500">Updated: {amm.updatedAt ?? "-"}</p>
          <p className="text-xs text-slate-500">Last price {token1}/{token0}: {asNum(amm.lastPriceToken1).toFixed(6)}</p>
          <p className="text-xs text-slate-500">Volume: {asNum(amm.volumeToken0).toFixed(4)} {token0} / {asNum(amm.volumeToken1).toFixed(4)} {token1}</p>
          <p className="text-xs text-slate-500">Trades tracked: {state?.trades?.length ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

function PolicyInputs({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-slate-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function ActionBox({ title, children, onClick }: { title: string; children: ReactNode; onClick: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="font-semibold text-slate-200">{title}</p>
      <div className="space-y-2">{children}</div>
      <button onClick={onClick} className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500">
        Execute
      </button>
    </div>
  );
}

function Inputs({
  provider,
  setProvider,
  amount0,
  setAmount0,
  amount1,
  setAmount1,
  token0,
  token1
}: {
  provider: string;
  setProvider: (v: string) => void;
  amount0: string;
  setAmount0: (v: string) => void;
  amount1: string;
  setAmount1: (v: string) => void;
  token0: string;
  token1: string;
}) {
  return (
    <>
      <label className="block space-y-1">
        <span className="text-slate-400">Provider</span>
        <input value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">{token0} amount</span>
        <input value={amount0} onChange={(e) => setAmount0(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
      </label>
      <label className="block space-y-1">
        <span className="text-slate-400">{token1} amount</span>
        <input value={amount1} onChange={(e) => setAmount1(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1" />
      </label>
    </>
  );
}
