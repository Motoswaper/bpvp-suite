import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { cookies as readCookies } from "next/headers";
import { NextRequest } from "next/server";

export type UserRole = "admin" | "trader" | "risk" | "viewer" | "operator";

export type AuthUser = {
  username: string;
  password?: string;
  passwordHash?: string;
  role: UserRole;
  otpSecret?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SessionClaims = {
  username: string;
  role: UserRole;
  mfa: boolean;
  walletAddress?: string;
  walletVerificationMethod?: "evm_personal_sign" | "bitcoin_message";
  walletNetwork?: "evm-test" | "signet-testnet";
  exp: number;
};

const SESSION_COOKIE = "axe_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/** Resolve at call time so CI can set BPVP_AUTH_USER_STORE and Next never bakes a wrong cwd into the bundle. */
function getUserStorePath() {
  const raw = process.env["BPVP_AUTH_USER_STORE"]?.trim();
  if (raw) return raw;
  return path.resolve(process.cwd(), "..", ".run", "auth-users.json");
}

type WalletChallenge = {
  nonce: string;
  statement: string;
  requestedAt: number;
};

const walletChallenges = new Map<string, WalletChallenge>();

const SCRYPT_PARAMS = {
  N: 1 << 14,
  r: 8,
  p: 1,
  keylen: 32
} as const;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p
  });
  return [
    "scrypt",
    String(SCRYPT_PARAMS.N),
    String(SCRYPT_PARAMS.r),
    String(SCRYPT_PARAMS.p),
    salt.toString("base64url"),
    key.toString("base64url")
  ].join("$");
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = String(storedHash || "").split("$");
  if (parts.length === 6 && parts[0] === "scrypt") {
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || expected.length === 0) {
      return false;
    }
    const derived = scryptSync(password, salt, expected.length, { N, r, p });
    return timingSafeEqual(derived, expected);
  }
  return false;
}

function safeEq(a: string, b: string): boolean {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function signingSecret() {
  return process.env.BPVP_AUTH_SIGNING_SECRET || process.env.AXE_HMAC_SECRET || process.env.DASHBOARD_PASSWORD || "bpvp-dev-secret";
}

function toB64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromB64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function parseUsersConfig(): AuthUser[] {
  const stored = readUsersFromStore();
  if (stored.length > 0) {
    return stored;
  }

  const raw = process.env.BPVP_AUTH_USERS_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<Partial<AuthUser>>;
      const users = parsed
        .map((u) => ({
          username: String(u.username ?? "").trim(),
          password: u.password ? String(u.password) : undefined,
          passwordHash: u.passwordHash ? String(u.passwordHash) : (u.password ? hashPassword(String(u.password)) : undefined),
          role: normalizeUserRole(u.role as string | undefined),
          otpSecret: u.otpSecret ? String(u.otpSecret) : undefined,
          enabled: u.enabled !== false
        }))
        .filter((u) => u.username && (u.password || u.passwordHash));
      if (users.length > 0) {
        writeUsersToStore(users);
        return users;
      }
    } catch {
      // Fall back to default user below.
    }
  }

  const fallbackPassword = process.env.DASHBOARD_PASSWORD ?? "";
  return [
    {
      username: "admin",
      password: fallbackPassword || undefined,
      passwordHash: fallbackPassword ? hashPassword(fallbackPassword) : undefined,
      role: "admin"
    }
  ];
}

type StoredUsersDoc = {
  users: AuthUser[];
  updatedAt: string;
};

export function normalizeUserRole(role: string | undefined): UserRole {
  const r = String(role ?? "").trim().toLowerCase();
  switch (r) {
    case "admin":
    case "trader":
    case "risk":
    case "viewer":
    case "operator":
      return r;
    default:
      return "viewer";
  }
}

function sanitizeUsers(users: AuthUser[]): AuthUser[] {
  return users
    .map((u) => ({
      username: String(u.username || "").trim(),
      passwordHash: u.passwordHash ? String(u.passwordHash) : (u.password ? hashPassword(String(u.password)) : undefined),
      role: normalizeUserRole(u.role),
      otpSecret: u.otpSecret ? String(u.otpSecret) : undefined,
      enabled: u.enabled !== false,
      createdAt: u.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    .filter((u) => u.username && u.passwordHash);
}

function ensureStoreDir() {
  const dir = path.dirname(getUserStorePath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readUsersFromStore(): AuthUser[] {
  try {
    const storePath = getUserStorePath();
    if (!existsSync(storePath)) return [];
    const raw = readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as StoredUsersDoc;
    if (!Array.isArray(parsed.users)) return [];
    return sanitizeUsers(parsed.users);
  } catch {
    return [];
  }
}

function writeUsersToStore(users: AuthUser[]) {
  ensureStoreDir();
  const sanitized = sanitizeUsers(users);
  const hasEnabledAdmin = sanitized.some((u) => u.role === "admin" && u.enabled !== false);
  if (!hasEnabledAdmin) {
    throw new Error("at least one enabled admin user is required");
  }
  const doc: StoredUsersDoc = {
    users: sanitized,
    updatedAt: new Date().toISOString()
  };
  writeFileSync(getUserStorePath(), JSON.stringify(doc, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function listUsersSafe() {
  return parseUsersConfig().map((u) => ({
    username: u.username,
    role: u.role,
    enabled: u.enabled !== false,
    hasOtp: Boolean(u.otpSecret),
    createdAt: u.createdAt ?? null,
    updatedAt: u.updatedAt ?? null
  }));
}

export function upsertUser(input: {
  username: string;
  role: UserRole;
  password?: string;
  otpSecret?: string;
  enabled?: boolean;
}) {
  const username = input.username.trim();
  if (!username) throw new Error("username is required");
  const users = parseUsersConfig();
  const existingIndex = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  const now = new Date().toISOString();
  const existing = existingIndex >= 0 ? users[existingIndex] : null;
  const next: AuthUser = {
    username,
    role: input.role,
    enabled: input.enabled !== false,
    otpSecret: input.otpSecret ? String(input.otpSecret) : existing?.otpSecret,
    passwordHash: input.password
      ? hashPassword(input.password)
      : existing?.passwordHash ?? (existing?.password ? hashPassword(existing.password) : undefined),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (!next.passwordHash) {
    throw new Error("password is required for new users");
  }
  if (existingIndex >= 0) users[existingIndex] = next;
  else users.push(next);
  writeUsersToStore(users);
}

export function setUserEnabled(username: string, enabled: boolean) {
  const users = parseUsersConfig();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx < 0) throw new Error("user not found");
  users[idx] = { ...users[idx], enabled, updatedAt: new Date().toISOString() };
  writeUsersToStore(users);
}

export function createSessionToken(claims: Omit<SessionClaims, "exp">) {
  const payload: SessionClaims = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const encoded = toB64Url(JSON.stringify(payload));
  const sig = createHmac("sha256", signingSecret()).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(encoded).digest("hex");
  if (!safeEq(sig, expected)) return null;
  try {
    const payload = JSON.parse(fromB64Url(encoded)) as SessionClaims;
    if (!payload.username || payload.role == null || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    payload.role = normalizeUserRole(String(payload.role));
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): SessionClaims | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function getSessionFromServerCookies() {
  const store = await readCookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Secure cookies require HTTPS; allow HTTP smoke tests and local prod runs via BPVP_SESSION_COOKIE_SECURE=false */
function sessionCookieSecure(): boolean {
  const raw = process.env.BPVP_SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return process.env.NODE_ENV === "production";
}

export function buildSessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: sessionCookieSecure(),
      sameSite: "strict" as const,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    }
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    options: {
      path: "/",
      maxAge: 0
    }
  };
}

export function authenticateUser(input: { username: string; password: string; otp?: string }) {
  const users = parseUsersConfig();
  const username = input.username.trim().toLowerCase();
  const match = users.find((u) => u.username.toLowerCase() === username);
  if (!match) return { ok: false as const, reason: "invalid_credentials" };
  if (match.enabled === false) return { ok: false as const, reason: "user_disabled" };
  const expectedHash = match.passwordHash || "";
  const passwordOk =
    expectedHash.length > 0
      ? verifyPassword(input.password, expectedHash)
      : match.password
        ? safeEq(input.password, match.password)
        : false;
  if (!passwordOk) {
    return { ok: false as const, reason: "invalid_credentials" };
  }
  if (match.otpSecret) {
    if (!input.otp || !safeEq(input.otp, match.otpSecret)) {
      return { ok: false as const, reason: "invalid_otp" };
    }
  }
  return {
    ok: true as const,
    user: {
      username: match.username,
      role: match.role,
      mfa: Boolean(match.otpSecret)
    }
  };
}

export function canAccess(session: SessionClaims | null, allowed: UserRole[]) {
  if (!session) return false;
  const role = normalizeUserRole(String(session.role));
  return allowed.includes(role);
}

export function issueWalletChallenge(username: string) {
  const nonce = createHash("sha256")
    .update(`${username}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 24);
  const challenge: WalletChallenge = {
    nonce,
    statement: "Sign this challenge to link your wallet with BPVP session",
    requestedAt: Math.floor(Date.now() / 1000)
  };
  walletChallenges.set(username, challenge);
  return challenge;
}

export function verifyWalletChallenge(username: string, nonce: string) {
  const challenge = walletChallenges.get(username);
  if (!challenge) return false;
  const now = Math.floor(Date.now() / 1000);
  if (challenge.nonce !== nonce) return false;
  if (now-challenge.requestedAt > 300) return false;
  walletChallenges.delete(username);
  return true;
}
