import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { canAccess, getSessionFromRequest } from "@/lib/auth";
import { checkRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";
import { writeSecurityEvent } from "@/lib/securityAudit";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(process.cwd(), "..");

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

const allowedActions: Set<OpsAction> = new Set([
  "status",
  "statusDetailed",
  "runProductionReadiness",
  "start",
  "stop",
  "restart",
  "publishOnline",
  "unpublishOnline",
  "publishDomain",
  "unpublishDomain",
  "runDailyReport",
  "verifyDailyReport",
  "installDailyReportAgent",
  "uninstallDailyReportAgent",
  "runAmmAudit",
  "installAmmAuditAgent",
  "uninstallAmmAuditAgent",
  "latestAmmAudit",
  "maximumSecureMode",
  "panicMode"
]);

function runScript(scriptName: string, env: Record<string, string> = {}) {
  const scriptPath = path.join(repoRoot, "scripts", scriptName);
  return execFileAsync("/bin/sh", [scriptPath], {
    cwd: repoRoot,
    env: { ...process.env, ...env }
  });
}

async function runScriptSafe(scriptName: string, env: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await runScript(scriptName, env);
    return { ok: true as const, output: `${stdout}${stderr}`.trim() };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
    return { ok: false as const, output: output || (e.message ?? "Command failed") };
  }
}

async function getStatusOutput() {
  const lines: string[] = [];
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["ps", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"],
      { cwd: repoRoot, env: process.env }
    );
    lines.push("== Docker containers ==");
    lines.push(stdout.trim() || "(none)");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lines.push("== Docker containers ==");
    lines.push(`error: ${message}`);
  }

  try {
    const urlFile = path.join(repoRoot, ".run", "cloudflared.url");
    const url = (await fs.readFile(urlFile, "utf8")).trim();
    lines.push("");
    lines.push("== Public URL ==");
    lines.push(url || "(not published)");
  } catch {
    lines.push("");
    lines.push("== Public URL ==");
    lines.push("(not published)");
  }

  return lines.join("\n");
}

async function getAutomationStatus() {
  const reportDir = path.join(repoRoot, ".run", "reports");
  const logDir = path.join(repoRoot, ".run", "logs");
  const [dailyAgent, ammAgent] = await Promise.all([
    execFileAsync("launchctl", ["list", "com.bpvp.dailyreport"], { cwd: repoRoot, env: process.env }).then(() => true).catch(() => false),
    execFileAsync("launchctl", ["list", "com.bpvp.ammaudit"], { cwd: repoRoot, env: process.env }).then(() => true).catch(() => false)
  ]);

  const [reportNames, ammAuditExists, ammAuditSigExists] = await Promise.all([
    fs.readdir(reportDir).catch(() => [] as string[]),
    fs.access(path.join(reportDir, "amm-audit-latest.json")).then(() => true).catch(() => false),
    fs.access(path.join(reportDir, "amm-audit-latest.sig")).then(() => true).catch(() => false)
  ]);
  const dailySummaryExists = reportNames.some((name) => name.startsWith("daily-summary-") && name.endsWith(".txt"));

  const [dailyErrLog, ammErrLog] = await Promise.all([
    fs.readFile(path.join(logDir, "daily-report.stderr.log"), "utf8").catch(() => ""),
    fs.readFile(path.join(logDir, "amm-audit.stderr.log"), "utf8").catch(() => "")
  ]);
  const remediationLogPath = path.join(reportDir, "amm-remediation-events.ndjson");
  const remediationEventsRaw = await fs.readFile(remediationLogPath, "utf8").catch(() => "");
  const remediationEvents = remediationEventsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-25)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return { ts: "", status: "PARSE_ERROR", message: line };
      }
    });

  return {
    dailyAgentInstalled: dailyAgent,
    ammAuditAgentInstalled: ammAgent,
    dailySummaryExists,
    ammAuditExists,
    ammAuditSigExists,
    dailyErrorLogHasContent: dailyErrLog.trim().length > 0,
    ammAuditErrorLogHasContent: ammErrLog.trim().length > 0,
    remediationEvents
  };
}

async function applyPanicPolicy() {
  const secretsPath = path.join(repoRoot, ".run", "local-secrets.env");
  const secretsRaw = await fs.readFile(secretsPath, "utf8");
  const getSecret = (key: string) =>
    secretsRaw
      .split("\n")
      .find((line) => line.startsWith(`${key}=`))
      ?.slice(key.length + 1)
      .trim() ?? "";
  const apiKey = getSecret("AXE_API_KEY");
  const hmacSecret = getSecret("AXE_HMAC_SECRET");
  if (!apiKey || !hmacSecret) {
    throw new Error("Missing AXE API/HMAC secrets for panic mode");
  }
  const nonce = `panic-${Date.now()}`;
  const nonceTs = Math.floor(Date.now() / 1000);
  const bodyObj = {
    module: "market",
    type: "amm_set_policy",
    data: {
      maxPriceImpactBps: 50,
      maxSwapInRatioBps: 50,
      twapWindowSeconds: 900,
      twapMaxDeviationBps: 100,
      circuitBreakerEnabled: true,
      circuitBreakerCooldownSec: 900,
      nonceWindowSeconds: 600,
      nonce,
      nonceTs
    }
  };
  const body = JSON.stringify(bodyObj);
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const payload = `POST|/actions|${ts}|${body}`;
  const { createHmac } = await import("crypto");
  const signature = createHmac("sha256", hmacSecret).update(payload).digest("hex");
  const res = await fetch("http://localhost:28080/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-AXE-API-Key": apiKey,
      "X-AXE-Timestamp": ts,
      "X-AXE-Signature": signature
    },
    body
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`panic mode failed: ${raw}`);
  }
  return raw;
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      ip: getClientIp(req),
      route: "/api/admin/ops",
      reason: "invalid_origin"
    });
    return NextResponse.json({ ok: false, error: "invalid origin" }, { status: 403 });
  }
  const ip = getClientIp(req);
  const limit = checkRateLimit(`admin-ops:${ip}`, 20, 60_000);
  if (!limit.ok) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      ip,
      route: "/api/admin/ops",
      reason: "rate_limited"
    });
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429 });
  }
  const session = getSessionFromRequest(req);
  if (!canAccess(session, ["admin"])) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      actor: session?.username,
      role: session?.role,
      ip,
      route: "/api/admin/ops",
      reason: "unauthorized"
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const adminSession = session!;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "") as OpsAction;

  if (!allowedActions.has(action)) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "denied",
      actor: adminSession.username,
      role: adminSession.role,
      ip,
      route: "/api/admin/ops",
      action,
      reason: "invalid_action"
    });
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  const highRiskActions = new Set<OpsAction>([
    "panicMode",
    "maximumSecureMode",
    "publishDomain",
    "publishOnline",
    "restart",
    "stop"
  ]);
  if (highRiskActions.has(action)) {
    const expectedStepup = process.env.BPVP_ADMIN_STEPUP_TOKEN ?? "";
    if (!expectedStepup) {
      await writeSecurityEvent({
        category: "admin",
        outcome: "denied",
        actor: adminSession.username,
        role: adminSession.role,
        ip,
        route: "/api/admin/ops",
        action,
        reason: "stepup_not_configured"
      });
      return NextResponse.json({ ok: false, error: "step-up policy misconfigured" }, { status: 503 });
    }
    const provided = req.headers.get("x-bpvp-stepup-token") ?? "";
    if (!provided || provided !== expectedStepup) {
      await writeSecurityEvent({
        category: "admin",
        outcome: "denied",
        actor: adminSession.username,
        role: adminSession.role,
        ip,
        route: "/api/admin/ops",
        action,
        reason: "stepup_required"
      });
      return NextResponse.json({ ok: false, error: "step-up token required" }, { status: 403 });
    }
  }

  try {
    await writeSecurityEvent({
      category: "admin",
      outcome: "allowed",
      actor: adminSession.username,
      role: adminSession.role,
      ip,
      route: "/api/admin/ops",
      action
    });
    if (action === "status") {
      const output = await getStatusOutput();
      return NextResponse.json({ ok: true, output });
    }

    if (action === "statusDetailed") {
      const [output, automation] = await Promise.all([getStatusOutput(), getAutomationStatus()]);
      return NextResponse.json({ ok: true, output, automation });
    }

    if (action === "runProductionReadiness") {
      const { stdout, stderr } = await runScript("run-production-readiness.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "start") {
      const { stdout, stderr } = await runScript("start-suite.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "stop") {
      const { stdout, stderr } = await runScript("stop-suite.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "restart") {
      const stop = await runScript("stop-suite.sh");
      const start = await runScript("start-suite.sh");
      return NextResponse.json({
        ok: true,
        output: `${stop.stdout}${stop.stderr}\n${start.stdout}${start.stderr}`.trim()
      });
    }

    if (action === "publishOnline") {
      const { stdout, stderr } = await runScript("publish-online.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "unpublishOnline") {
      const { stdout, stderr } = await runScript("unpublish-online.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "publishDomain") {
      const token = String(body.cfTunnelToken ?? "");
      const hostname = String(body.cfHostname ?? "");
      if (!token || !hostname) {
        return NextResponse.json(
          { ok: false, error: "CF tunnel token and hostname are required" },
          { status: 400 }
        );
      }
      const { stdout, stderr } = await runScript("publish-domain.sh", {
        CF_TUNNEL_TOKEN: token,
        CF_HOSTNAME: hostname
      });
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "unpublishDomain") {
      const { stdout, stderr } = await runScript("unpublish-domain.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "runDailyReport") {
      const { stdout, stderr } = await runScript("daily-report.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "verifyDailyReport") {
      const { stdout, stderr } = await runScript("verify-daily-report.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "installDailyReportAgent") {
      const hour = String(body.dailyHour ?? "7");
      const minute = String(body.dailyMinute ?? "0");
      const { stdout, stderr } = await runScript("install-daily-report-agent.sh", {
        BPVP_DAILY_REPORT_HOUR: hour,
        BPVP_DAILY_REPORT_MINUTE: minute
      });
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "uninstallDailyReportAgent") {
      const { stdout, stderr } = await runScript("uninstall-daily-report-agent.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "runAmmAudit") {
      const { stdout, stderr } = await runScript("amm-auto-audit.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "installAmmAuditAgent") {
      const interval = String(body.ammAuditIntervalSeconds ?? "900");
      const alertUrl = String(body.ammAuditAlertWebhookUrl ?? "");
      const alertSecret = String(body.ammAuditAlertWebhookSecret ?? "");
      const autoRemediate = String(body.ammAuditAutoRemediate ?? "false");
      const { stdout, stderr } = await runScript("install-amm-audit-agent.sh", {
        BPVP_AMM_AUDIT_INTERVAL_SECONDS: interval,
        BPVP_AMM_AUDIT_ALERT_WEBHOOK_URL: alertUrl,
        BPVP_AMM_AUDIT_ALERT_WEBHOOK_SECRET: alertSecret,
        BPVP_AMM_AUDIT_AUTO_REMEDIATE: autoRemediate
      });
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "uninstallAmmAuditAgent") {
      const { stdout, stderr } = await runScript("uninstall-amm-audit-agent.sh");
      return NextResponse.json({ ok: true, output: `${stdout}${stderr}`.trim() });
    }

    if (action === "maximumSecureMode") {
      const dailyHour = String(body.dailyHour ?? "7");
      const dailyMinute = String(body.dailyMinute ?? "0");
      const ammInterval = String(body.ammAuditIntervalSeconds ?? "900");
      const ammAlertUrl = String(body.ammAuditAlertWebhookUrl ?? "");
      const ammAlertSecret = String(body.ammAuditAlertWebhookSecret ?? "");
      const [dailyInstall, ammInstall, dailyRun, dailyVerify, ammRun] = await Promise.all([
        runScriptSafe("install-daily-report-agent.sh", {
          BPVP_DAILY_REPORT_HOUR: dailyHour,
          BPVP_DAILY_REPORT_MINUTE: dailyMinute
        }),
        runScriptSafe("install-amm-audit-agent.sh", {
          BPVP_AMM_AUDIT_INTERVAL_SECONDS: ammInterval,
          BPVP_AMM_AUDIT_ALERT_WEBHOOK_URL: ammAlertUrl,
          BPVP_AMM_AUDIT_ALERT_WEBHOOK_SECRET: ammAlertSecret,
          BPVP_AMM_AUDIT_AUTO_REMEDIATE: "true"
        }),
        runScriptSafe("daily-report.sh"),
        runScriptSafe("verify-daily-report.sh"),
        runScriptSafe("amm-auto-audit.sh")
      ]);
      const [statusText, automation] = await Promise.all([getStatusOutput(), getAutomationStatus()]);
      const steps = [
        ["install-daily-report-agent.sh", dailyInstall],
        ["install-amm-audit-agent.sh", ammInstall],
        ["daily-report.sh", dailyRun],
        ["verify-daily-report.sh", dailyVerify],
        ["amm-auto-audit.sh", ammRun]
      ] as const;
      return NextResponse.json({
        ok: true,
        output: [
          "== Maximum Secure Mode Applied ==",
          ...steps.map(([name, result]) => `-- ${name} [${result.ok ? "OK" : "WARN"}]\n${result.output}`),
          "== Current Status ==",
          statusText
        ].join("\n\n"),
        automation
      });
    }

    if (action === "panicMode") {
      const panicResult = await applyPanicPolicy();
      const [statusText, automation] = await Promise.all([getStatusOutput(), getAutomationStatus()]);
      return NextResponse.json({
        ok: true,
        output: `== Panic Mode Applied ==\n${panicResult}\n\n== Current Status ==\n${statusText}`,
        automation
      });
    }

    const reportPath = path.join(repoRoot, ".run", "reports", "amm-audit-latest.json");
    const sigPath = path.join(repoRoot, ".run", "reports", "amm-audit-latest.sig");
    const [report, sig] = await Promise.all([
      fs.readFile(reportPath, "utf8"),
      fs.readFile(sigPath, "utf8")
    ]);
    return NextResponse.json({
      ok: true,
      output: `== AMM Audit Latest ==\n${report}\n\n== Signature ==\n${sig.trim()}`
    });
  } catch (error: unknown) {
    await writeSecurityEvent({
      category: "admin",
      outcome: "error",
      actor: adminSession.username,
      role: adminSession.role,
      ip,
      route: "/api/admin/ops",
      action,
      reason: error instanceof Error ? error.message : String(error)
    });
    const e = error as { stdout?: string; stderr?: string; message?: string };
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
    return NextResponse.json(
      { ok: false, error: e.message ?? "Command failed", output },
      { status: 500 }
    );
  }
}
