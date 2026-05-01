import crypto from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type IssuerKeypair = {
  privateKeyPem: string;
  publicKeyPem: string;
};

type IssuerKeyRecord = IssuerKeypair & {
  kid: string;
  status: "signing" | "verify_only" | "retired";
  createdAt: string;
  rotatedFromKid?: string;
};

type IssuerKeyring = {
  activeKid: string;
  keys: IssuerKeyRecord[];
  updatedAt: string;
};

const KEYRING_PATH = path.resolve(process.cwd(), "..", ".run", "did-issuer-keyring.json");

function toB64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function ensureIssuerKeypair(): IssuerKeypair {
  const envPriv = process.env.BPVP_DID_ISSUER_PRIVATE_KEY_PEM?.trim();
  const envPub = process.env.BPVP_DID_ISSUER_PUBLIC_KEY_PEM?.trim();
  if (envPriv && envPub) {
    return { privateKeyPem: envPriv, publicKeyPem: envPub };
  }
  const keyring = ensureIssuerKeyring();
  const active = keyring.keys.find((k) => k.kid === keyring.activeKid && k.status === "signing");
  if (!active) {
    throw new Error("did_issuer_active_key_missing");
  }
  return { privateKeyPem: active.privateKeyPem, publicKeyPem: active.publicKeyPem };
}

function keyId(publicKeyPem: string) {
  return `bpvp-did-${crypto.createHash("sha256").update(publicKeyPem).digest("hex").slice(0, 12)}`;
}

function createKeyRecord(rotatedFromKid?: string): IssuerKeyRecord {
  const generated = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const privateKeyPem = generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = generated.publicKey.export({ type: "spki", format: "pem" }).toString();
  return {
    kid: keyId(publicKeyPem),
    privateKeyPem,
    publicKeyPem,
    status: "signing",
    createdAt: new Date().toISOString(),
    rotatedFromKid
  };
}

function ensureIssuerKeyring(): IssuerKeyring {
  const envPriv = process.env.BPVP_DID_ISSUER_PRIVATE_KEY_PEM?.trim();
  const envPub = process.env.BPVP_DID_ISSUER_PUBLIC_KEY_PEM?.trim();
  if (envPriv && envPub) {
    const kid = keyId(envPub);
    return {
      activeKid: kid,
      keys: [{ kid, privateKeyPem: envPriv, publicKeyPem: envPub, status: "signing", createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString()
    };
  }
  if (existsSync(KEYRING_PATH)) {
    const parsed = JSON.parse(readFileSync(KEYRING_PATH, "utf8")) as IssuerKeyring;
    if (Array.isArray(parsed.keys) && parsed.keys.length > 0 && parsed.activeKid) return parsed;
  }
  const first = createKeyRecord();
  const initial: IssuerKeyring = {
    activeKid: first.kid,
    keys: [first],
    updatedAt: new Date().toISOString()
  };
  mkdirSync(path.dirname(KEYRING_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(KEYRING_PATH, JSON.stringify(initial, null, 2), { mode: 0o600 });
  return initial;
}

function persistKeyring(ring: IssuerKeyring) {
  if (process.env.BPVP_DID_ISSUER_PRIVATE_KEY_PEM && process.env.BPVP_DID_ISSUER_PUBLIC_KEY_PEM) {
    throw new Error("cannot persist keyring while env-managed DID issuer keys are enabled");
  }
  mkdirSync(path.dirname(KEYRING_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(KEYRING_PATH, JSON.stringify(ring, null, 2), { mode: 0o600 });
}

export function getDidIssuerPublicJwk() {
  const keyring = ensureIssuerKeyring();
  const active = keyring.keys.find((k) => k.kid === keyring.activeKid) ?? keyring.keys[0];
  const publicKey = crypto.createPublicKey(active.publicKeyPem);
  const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  return { jwk, kid: active.kid };
}

export function getDidIssuerPublicJwks() {
  const keyring = ensureIssuerKeyring();
  const keys = keyring.keys
    .filter((k) => k.status !== "retired")
    .map((k) => {
      const publicKey = crypto.createPublicKey(k.publicKeyPem);
      const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
      return {
        ...jwk,
        kid: k.kid,
        use: "sig",
        alg: "ES256",
        status: k.status
      };
    });
  return { keys, activeKid: keyring.activeKid };
}

export function signDidJwt(payload: Record<string, unknown>) {
  const keyring = ensureIssuerKeyring();
  const signing = keyring.keys.find((k) => k.kid === keyring.activeKid && k.status === "signing");
  if (!signing) throw new Error("did_issuer_signing_key_not_available");
  const keys = ensureIssuerKeypair();
  const kid = signing.kid;
  const header = { alg: "ES256", typ: "JWT", kid };
  const h = toB64Url(JSON.stringify(header));
  const p = toB64Url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto.sign("sha256", Buffer.from(data), keys.privateKeyPem).toString("base64url");
  return `${h}.${p}.${sig}`;
}

export function verifyDidJwt(token: string | undefined) {
  if (!token) return { ok: false as const, kid: "" };
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return { ok: false as const, kid: "" };
  let kid = "";
  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as { kid?: string };
    kid = String(header.kid ?? "");
  } catch {
    return { ok: false as const, kid: "" };
  }
  const keyring = ensureIssuerKeyring();
  const key = keyring.keys.find((k) => k.kid === kid && k.status !== "retired");
  if (!key) return { ok: false as const, kid };
  const ok = crypto.verify("sha256", Buffer.from(`${h}.${p}`), key.publicKeyPem, Buffer.from(sig, "base64url"));
  return { ok, kid };
}

export function rotateDidIssuerKey() {
  const ring = ensureIssuerKeyring();
  const prevKid = ring.activeKid;
  ring.keys = ring.keys.map((k) => (k.kid === prevKid ? { ...k, status: "verify_only" as const } : k));
  const next = createKeyRecord(prevKid);
  ring.keys.unshift(next);
  ring.activeKid = next.kid;
  ring.updatedAt = new Date().toISOString();
  persistKeyring(ring);
  return { activeKid: ring.activeKid, previousKid: prevKid };
}
