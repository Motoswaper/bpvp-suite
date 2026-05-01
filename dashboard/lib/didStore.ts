import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getDidIssuerPublicJwk, signDidJwt, verifyDidJwt } from "@/lib/didIssuerCrypto";

export type DidIdentity = {
  did: string;
  controller: string;
  walletAddress?: string;
  label?: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
};

export type DidCredential = {
  id: string;
  subjectDid: string;
  issuer: string;
  type: string;
  claims: Record<string, string | number | boolean>;
  status: "active" | "revoked" | "expired";
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revocationReason?: string;
  proofJwt?: string;
  integrityHash?: string;
};

type DidStore = {
  identities: DidIdentity[];
  credentials: DidCredential[];
  updatedAt: string;
};

const STORE_PATH = path.resolve(process.cwd(), "..", ".run", "did-registry.json");

function makeIntegrityHash(input: Omit<DidCredential, "integrityHash" | "proofJwt">) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function initialStore(): DidStore {
  return {
    identities: [],
    credentials: [],
    updatedAt: new Date().toISOString()
  };
}

async function readStore(): Promise<DidStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as DidStore;
    if (!Array.isArray(parsed.identities) || !Array.isArray(parsed.credentials)) {
      return initialStore();
    }
    return parsed;
  } catch {
    return initialStore();
  }
}

async function writeStore(store: DidStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true, mode: 0o700 });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
}

function normalizeDid(value: string) {
  return value.trim().toLowerCase();
}

export async function listDidIdentities() {
  const store = await readStore();
  return [...store.identities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listDidCredentials() {
  const store = await readStore();
  return [...store.credentials].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export async function createDidIdentity(input: {
  controller: string;
  walletAddress?: string;
  label?: string;
}) {
  const store = await readStore();
  const controller = input.controller.trim();
  if (!controller) throw new Error("controller_required");
  if (controller.length > 120) throw new Error("controller_too_long");
  if (input.label && input.label.length > 120) throw new Error("label_too_long");
  const now = new Date().toISOString();
  const did = normalizeDid(`did:bpvp:${crypto.randomUUID()}`);
  if (store.identities.some((x) => normalizeDid(x.did) === did)) {
    throw new Error("did_collision_retry");
  }
  const identity: DidIdentity = {
    did,
    controller,
    walletAddress: input.walletAddress?.trim() || undefined,
    label: input.label?.trim() || undefined,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  store.identities.push(identity);
  store.updatedAt = now;
  await writeStore(store);
  return identity;
}

export async function issueDidCredential(input: {
  subjectDid: string;
  issuer: string;
  type: string;
  claims: Record<string, string | number | boolean>;
  expiresAt?: string;
}) {
  const store = await readStore();
  const subjectDid = normalizeDid(input.subjectDid);
  const identity = store.identities.find((x) => normalizeDid(x.did) === subjectDid);
  if (!identity) throw new Error("subject_did_not_found");
  if (identity.status !== "active") throw new Error("subject_did_not_active");
  if (!input.type.trim()) throw new Error("credential_type_required");
  if (input.type.length > 80) throw new Error("credential_type_too_long");
  if (input.issuer.trim().length > 120) throw new Error("issuer_too_long");
  const now = new Date().toISOString();
  const cred: DidCredential = {
    id: `vc_bpvp_${crypto.randomUUID()}`,
    subjectDid,
    issuer: input.issuer.trim(),
    type: input.type.trim(),
    claims: input.claims,
    status: "active",
    issuedAt: now,
    expiresAt: input.expiresAt
  };
  const integrityHash = makeIntegrityHash(cred);
  const proofJwt = signDidJwt({
    jti: cred.id,
    sub: cred.subjectDid,
    iss: cred.issuer,
    vcType: cred.type,
    iat: Math.floor(Date.parse(cred.issuedAt) / 1000),
    exp: cred.expiresAt ? Math.floor(Date.parse(cred.expiresAt) / 1000) : undefined,
    integrityHash
  });
  cred.integrityHash = integrityHash;
  cred.proofJwt = proofJwt;
  store.credentials.push(cred);
  store.updatedAt = now;
  await writeStore(store);
  return cred;
}

export async function revokeDidCredential(input: { credentialId: string; reason?: string }) {
  const store = await readStore();
  const now = new Date().toISOString();
  const cred = store.credentials.find((x) => x.id === input.credentialId);
  if (!cred) throw new Error("credential_not_found");
  if (cred.status === "revoked") return cred;
  cred.status = "revoked";
  cred.revokedAt = now;
  cred.revocationReason = input.reason?.trim() || "admin_revocation";
  store.updatedAt = now;
  await writeStore(store);
  return cred;
}

export async function verifyDidCredential(input: { credentialId: string }) {
  const store = await readStore();
  const cred = store.credentials.find((x) => x.id === input.credentialId);
  if (!cred) return { ok: false as const, status: "not_found" as const };
  if (!verifyDidJwt(cred.proofJwt).ok) {
    return { ok: false as const, status: "invalid_signature" as const, credential: cred };
  }
  const snapshot: Omit<DidCredential, "integrityHash" | "proofJwt"> = {
    id: cred.id,
    subjectDid: cred.subjectDid,
    issuer: cred.issuer,
    type: cred.type,
    claims: cred.claims,
    status: cred.status,
    issuedAt: cred.issuedAt,
    expiresAt: cred.expiresAt,
    revokedAt: cred.revokedAt,
    revocationReason: cred.revocationReason
  };
  const expectedHash = makeIntegrityHash(snapshot);
  if (!cred.integrityHash || cred.integrityHash !== expectedHash) {
    return { ok: false as const, status: "integrity_mismatch" as const, credential: cred };
  }
  if (cred.status === "revoked") return { ok: false as const, status: "revoked" as const, credential: cred };
  if (cred.expiresAt && Date.parse(cred.expiresAt) < Date.now()) {
    cred.status = "expired";
    store.updatedAt = new Date().toISOString();
    await writeStore(store);
    return { ok: false as const, status: "expired" as const, credential: cred };
  }
  return { ok: true as const, status: "active" as const, credential: cred };
}

export async function listDidRevocations() {
  const store = await readStore();
  return store.credentials
    .filter((x) => x.status === "revoked")
    .map((x) => ({
      credentialId: x.id,
      revokedAt: x.revokedAt,
      reason: x.revocationReason || "revoked"
    }))
    .sort((a, b) => String(b.revokedAt || "").localeCompare(String(a.revokedAt || "")));
}

export async function resolveDidIdentity(did: string) {
  const store = await readStore();
  const identity = store.identities.find((x) => normalizeDid(x.did) === normalizeDid(did));
  if (!identity) return null;
  const issuer = getDidIssuerPublicJwk();
  return {
    "@context": "https://www.w3.org/ns/did/v1",
    id: identity.did,
    controller: identity.controller,
    verificationMethod: [
      {
        id: `${identity.did}#controller-key`,
        type: "JsonWebKey2020",
        controller: identity.controller,
        publicKeyJwk: issuer.jwk
      }
    ],
    service: identity.walletAddress
      ? [
          {
            id: `${identity.did}#wallet`,
            type: "EVMAddress",
            serviceEndpoint: `eip155:testnet:${identity.walletAddress}`
          }
        ]
      : []
  };
}
