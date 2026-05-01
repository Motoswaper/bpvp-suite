import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

type SecurityEvent = {
  category: "auth" | "admin" | "action";
  outcome: "allowed" | "denied" | "error";
  actor?: string;
  role?: string;
  ip?: string;
  route: string;
  action?: string;
  reason?: string;
  details?: Record<string, unknown>;
};

const logDir = path.resolve(process.cwd(), "..", ".run", "logs");
const logFile = path.join(logDir, "security-events.ndjson");
const signingKey =
  process.env.BPVP_AUDIT_LOG_SIGNING_KEY ||
  process.env.AXE_HMAC_SECRET ||
  process.env.BPVP_AUTH_SIGNING_SECRET ||
  "bpvp-audit-dev-key";

export async function writeSecurityEvent(event: SecurityEvent) {
  try {
    await fs.mkdir(logDir, { recursive: true });
    const ts = new Date().toISOString();
    const payload = { ts, ...event };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", signingKey).update(raw).digest("hex");
    const line = `${JSON.stringify({ ...payload, signature })}\n`;
    await fs.appendFile(logFile, line, "utf8");
  } catch {
    // Logging must never break API execution paths.
  }
}
