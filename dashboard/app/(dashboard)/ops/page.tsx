"use client";

import { FormEvent, useEffect, useState } from "react";
import { AgentReadonlyPanel } from "@/components/docs/AgentReadonlyPanel";
import { Navbar } from "@/components/layout/Navbar";
import { useLocale } from "@/lib/useLocale";

type OpsAction =
  | "status"
  | "statusDetailed"
  | "runProductionReadiness"
  | "start"
  | "stop"
  | "restart"
  | "publishOnline"
  | "unpublishOnline"
  | "publishDomain"
  | "unpublishDomain"
  | "runDailyReport"
  | "verifyDailyReport"
  | "installDailyReportAgent"
  | "uninstallDailyReportAgent"
  | "runAmmAudit"
  | "installAmmAuditAgent"
  | "uninstallAmmAuditAgent"
  | "latestAmmAudit"
  | "maximumSecureMode"
  | "panicMode";

type AutomationStatus = {
  dailyAgentInstalled?: boolean;
  ammAuditAgentInstalled?: boolean;
  dailySummaryExists?: boolean;
  ammAuditExists?: boolean;
  ammAuditSigExists?: boolean;
  dailyErrorLogHasContent?: boolean;
  ammAuditErrorLogHasContent?: boolean;
  remediationEvents?: Array<{
    ts?: string;
    status?: string;
    message?: string;
    eventType?: string;
  }>;
};

type ManagedUser = {
  username: string;
  role: "admin" | "trader" | "risk" | "viewer";
  enabled: boolean;
  hasOtp: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

async function runOps(action: OpsAction, payload: Record<string, string> = {}) {
  const res = await fetch("/api/admin/ops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as { ok: boolean; output?: string; automation?: AutomationStatus };
}

export default function OpsPage() {
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("Ready.");
  const [error, setError] = useState("");
  const [cfHostname, setCfHostname] = useState("");
  const [cfTunnelToken, setCfTunnelToken] = useState("");
  const [dailyHour, setDailyHour] = useState("7");
  const [dailyMinute, setDailyMinute] = useState("0");
  const [ammAuditIntervalSeconds, setAmmAuditIntervalSeconds] = useState("900");
  const [ammAuditAlertWebhookUrl, setAmmAuditAlertWebhookUrl] = useState("");
  const [ammAuditAlertWebhookSecret, setAmmAuditAlertWebhookSecret] = useState("");
  const [ammAuditAutoRemediate, setAmmAuditAutoRemediate] = useState(true);
  const [automation, setAutomation] = useState<AutomationStatus | null>(null);
  const [liveRefresh, setLiveRefresh] = useState(true);
  const [liveRefreshSec, setLiveRefreshSec] = useState("20");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState<ManagedUser["role"]>("trader");
  const [authOtpSecret, setAuthOtpSecret] = useState("");

  async function handleAction(action: OpsAction, payload: Record<string, string> = {}) {
    setBusy(true);
    setError("");
    try {
      const result = await runOps(action, payload);
      setOutput(String(result.output ?? "Done."));
      setAutomation(result.automation ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPublishDomain(e: FormEvent) {
    e.preventDefault();
    await handleAction("publishDomain", { cfHostname, cfTunnelToken });
  }

  async function refreshDetailedStatus() {
    await handleAction("statusDetailed");
  }

  async function refreshUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to load users");
    }
    setUsers(Array.isArray(data.users) ? (data.users as ManagedUser[]) : []);
  }

  async function upsertUser() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        action: "upsert",
        username: authUsername,
        password: authPassword || undefined,
        role: authRole,
        otpSecret: authOtpSecret || undefined,
        enabled: true
      };
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save user");
      }
      setUsers(Array.isArray(data.users) ? (data.users as ManagedUser[]) : []);
      setAuthPassword("");
      setAuthOtpSecret("");
      setOutput(`Auth user upserted: ${authUsername}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function setUserEnabled(username: string, enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setEnabled", username, enabled })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update user");
      }
      setUsers(Array.isArray(data.users) ? (data.users as ManagedUser[]) : []);
      setOutput(`User ${username} set to ${enabled ? "enabled" : "disabled"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!liveRefresh) return;
    const sec = Math.max(5, Number(liveRefreshSec) || 20);
    const timer = setInterval(() => {
      if (!busy) {
        void refreshDetailedStatus();
      }
    }, sec * 1000);
    return () => clearInterval(timer);
  }, [busy, liveRefresh, liveRefreshSec]);

  useEffect(() => {
    void refreshUsers();
  }, []);

  return (
    <section className="space-y-6">
      <Navbar title="Ops Admin" />

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Local Controls</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button disabled={busy} onClick={() => handleAction("status")} className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50">Status</button>
          <button disabled={busy} onClick={refreshDetailedStatus} className="rounded-md bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50">Detailed Status</button>
          <button disabled={busy} onClick={() => handleAction("runProductionReadiness")} className="rounded-md bg-cyan-700 px-3 py-2 text-sm hover:bg-cyan-600 disabled:opacity-50">Run Production Readiness</button>
          <button disabled={busy} onClick={() => handleAction("start")} className="rounded-md bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50">Start Suite</button>
          <button disabled={busy} onClick={() => handleAction("stop")} className="rounded-md bg-rose-700 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50">Stop Suite</button>
          <button disabled={busy} onClick={() => handleAction("restart")} className="rounded-md bg-blue-700 px-3 py-2 text-sm hover:bg-blue-600 disabled:opacity-50">Restart Suite</button>
          <button disabled={busy} onClick={() => handleAction("maximumSecureMode", { dailyHour, dailyMinute, ammAuditIntervalSeconds, ammAuditAlertWebhookUrl, ammAuditAlertWebhookSecret })} className="rounded-md bg-amber-700 px-3 py-2 text-sm hover:bg-amber-600 disabled:opacity-50">Maximum Secure Mode</button>
          <button disabled={busy} onClick={() => handleAction("panicMode")} className="rounded-md bg-rose-800 px-3 py-2 text-sm hover:bg-rose-700 disabled:opacity-50">PANIC MODE</button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Auth v2.1 User Management</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={authUsername}
            onChange={(e) => setAuthUsername(e.target.value)}
            placeholder="Username e.g. trader-desk-01"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password (required for new user) e.g. S3cure!Pass#2026"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={authRole}
            onChange={(e) => setAuthRole(e.target.value as ManagedUser["role"])}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="admin">admin</option>
            <option value="trader">trader</option>
            <option value="risk">risk</option>
            <option value="viewer">viewer</option>
          </select>
          <input
            type="text"
            value={authOtpSecret}
            onChange={(e) => setAuthOtpSecret(e.target.value)}
            placeholder="OTP secret (optional) e.g. 839201"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button disabled={busy || !authUsername} onClick={() => void upsertUser()} className="rounded-md bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50">Create / Update User</button>
          <button disabled={busy} onClick={() => void refreshUsers()} className="rounded-md bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50">Refresh Users</button>
        </div>
        <div className="overflow-auto rounded border border-slate-800 bg-black/40 p-3">
          {users.length === 0 ? (
            <p className="text-xs text-slate-500">No users found.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.username} className="flex items-center justify-between gap-3 rounded border border-slate-800 px-3 py-2">
                  <p className="text-xs text-slate-300">
                    <span className="font-semibold">{u.username}</span> | role={u.role} | otp={u.hasOtp ? "yes" : "no"} | {u.enabled ? "enabled" : "disabled"}
                  </p>
                  <div className="flex gap-2">
                    <button disabled={busy || u.enabled} onClick={() => void setUserEnabled(u.username, true)} className="rounded bg-emerald-800 px-2 py-1 text-xs hover:bg-emerald-700 disabled:opacity-50">Enable</button>
                    <button disabled={busy || !u.enabled} onClick={() => void setUserEnabled(u.username, false)} className="rounded bg-rose-800 px-2 py-1 text-xs hover:bg-rose-700 disabled:opacity-50">Disable</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Automation Semaphores</h2>
        <div className="mb-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={liveRefresh}
              onChange={(e) => setLiveRefresh(e.target.checked)}
            />
            Live auto-refresh
          </label>
          <input
            type="number"
            min={5}
            value={liveRefreshSec}
            onChange={(e) => setLiveRefreshSec(e.target.value)}
            className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
          <span className="text-xs text-slate-400">seconds</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Sem label="Daily Agent" on={Boolean(automation?.dailyAgentInstalled)} />
          <Sem label="AMM Audit Agent" on={Boolean(automation?.ammAuditAgentInstalled)} />
          <Sem label="Daily Reports" on={Boolean(automation?.dailySummaryExists)} />
          <Sem label="AMM Audit+Sig" on={Boolean(automation?.ammAuditExists) && Boolean(automation?.ammAuditSigExists)} />
          <Sem label="Daily Error Log" on={!Boolean(automation?.dailyErrorLogHasContent)} positiveLabel="CLEAN" negativeLabel="ERRORS" />
          <Sem label="AMM Error Log" on={!Boolean(automation?.ammAuditErrorLogHasContent)} positiveLabel="CLEAN" negativeLabel="ERRORS" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Remediation Event Log</h2>
        <div className="max-h-56 overflow-auto rounded border border-slate-800 bg-black/40 p-3">
          {(automation?.remediationEvents ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">No remediation events yet.</p>
          ) : (
            <div className="space-y-1">
              {(automation?.remediationEvents ?? []).slice().reverse().map((ev, idx) => (
                <p key={`${ev.ts ?? "na"}-${idx}`} className="text-xs text-slate-300">
                  [{ev.ts ?? "-"}] {ev.status ?? "-"}: {ev.message ?? "-"}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Public Access (No Domain)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <button disabled={busy} onClick={() => handleAction("publishOnline")} className="rounded-md bg-indigo-700 px-3 py-2 text-sm hover:bg-indigo-600 disabled:opacity-50">Publish Online</button>
          <button disabled={busy} onClick={() => handleAction("unpublishOnline")} className="rounded-md bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50">Unpublish Online</button>
        </div>
      </div>

      <form onSubmit={onPublishDomain} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Public Access (Fixed Domain)</h2>
        <input
          type="text"
          value={cfHostname}
          onChange={(e) => setCfHostname(e.target.value)}
          placeholder="CF hostname (e.g. testnet.btc-defi.com)"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={cfTunnelToken}
          onChange={(e) => setCfTunnelToken(e.target.value)}
          placeholder="CF tunnel token e.g. eyJhIjoi...<token>"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="submit" disabled={busy} className="rounded-md bg-purple-700 px-3 py-2 text-sm hover:bg-purple-600 disabled:opacity-50">Publish Domain</button>
          <button type="button" disabled={busy} onClick={() => handleAction("unpublishDomain")} className="rounded-md bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50">Unpublish Domain</button>
        </div>
      </form>

      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Daily Report Automation</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button disabled={busy} onClick={() => handleAction("runDailyReport")} className="rounded-md bg-indigo-700 px-3 py-2 text-sm hover:bg-indigo-600 disabled:opacity-50">Run Daily Report</button>
          <button disabled={busy} onClick={() => handleAction("verifyDailyReport")} className="rounded-md bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50">Verify Daily Report</button>
          <button disabled={busy} onClick={() => handleAction("installDailyReportAgent", { dailyHour, dailyMinute })} className="rounded-md bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50">Install Daily Agent</button>
          <button disabled={busy} onClick={() => handleAction("uninstallDailyReportAgent")} className="rounded-md bg-rose-700 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50">Uninstall Daily Agent</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="number"
            min={0}
            max={23}
            value={dailyHour}
            onChange={(e) => setDailyHour(e.target.value)}
            placeholder="Daily hour (0-23) e.g. 7"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            max={59}
            value={dailyMinute}
            onChange={(e) => setDailyMinute(e.target.value)}
            placeholder="Daily minute (0-59) e.g. 15"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">AMM Auto Audit Controls</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button disabled={busy} onClick={() => handleAction("runAmmAudit")} className="rounded-md bg-indigo-700 px-3 py-2 text-sm hover:bg-indigo-600 disabled:opacity-50">Run AMM Audit</button>
          <button disabled={busy} onClick={() => handleAction("latestAmmAudit")} className="rounded-md bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50">Show Latest AMM Audit</button>
          <button disabled={busy} onClick={() => handleAction("installAmmAuditAgent", { ammAuditIntervalSeconds, ammAuditAlertWebhookUrl, ammAuditAlertWebhookSecret, ammAuditAutoRemediate: String(ammAuditAutoRemediate) })} className="rounded-md bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50">Install AMM Audit Agent</button>
          <button disabled={busy} onClick={() => handleAction("uninstallAmmAuditAgent")} className="rounded-md bg-rose-700 px-3 py-2 text-sm hover:bg-rose-600 disabled:opacity-50">Uninstall AMM Audit Agent</button>
        </div>
        <input
          type="number"
          min={60}
          value={ammAuditIntervalSeconds}
          onChange={(e) => setAmmAuditIntervalSeconds(e.target.value)}
          placeholder="AMM audit interval seconds (min 60) e.g. 900"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={ammAuditAlertWebhookUrl}
          onChange={(e) => setAmmAuditAlertWebhookUrl(e.target.value)}
          placeholder="AMM alert webhook URL (optional) e.g. https://hooks.slack.com/services/..."
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={ammAuditAlertWebhookSecret}
          onChange={(e) => setAmmAuditAlertWebhookSecret(e.target.value)}
          placeholder="AMM alert webhook secret (optional) e.g. whsec_abc123"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={ammAuditAutoRemediate}
            onChange={(e) => setAmmAuditAutoRemediate(e.target.checked)}
          />
          Enable auto-remediation on AMM audit fail
        </label>
      </div>

      {error ? <p className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">{error}</p> : null}

      <div className="rounded-lg border border-slate-800 bg-black p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Output</h2>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-slate-300">{output}</pre>
      </div>
      <AgentReadonlyPanel locale={locale} audience="admin-only" />
    </section>
  );
}

function Sem({
  label,
  on,
  positiveLabel = "GREEN",
  negativeLabel = "RED"
}: {
  label: string;
  on: boolean;
  positiveLabel?: string;
  negativeLabel?: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${on ? "text-emerald-300" : "text-rose-300"}`}>{on ? positiveLabel : negativeLabel}</p>
    </div>
  );
}
