import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import * as bitcoinMessage from "bitcoinjs-message";
import { BIP32Factory } from "bip32";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { z } from "zod";

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

export type WalletNetwork = "signet" | "testnet";

const VaultSchema = z.object({
  version: z.literal(1),
  network: z.union([z.literal("signet"), z.literal("testnet")]),
  kdf: z.object({
    algorithm: z.literal("scrypt"),
    saltHex: z.string().min(16),
    n: z.number(),
    r: z.number(),
    p: z.number()
  }),
  cipher: z.object({
    algorithm: z.literal("aes-256-gcm"),
    ivHex: z.string().min(16),
    tagHex: z.string().min(16),
    ciphertextHex: z.string().min(16)
  })
});

type VaultFile = z.infer<typeof VaultSchema>;

function fail(msg: string): never {
  throw new Error(msg);
}

function ensurePassphrase(passphrase: string): string {
  if (!passphrase || passphrase.length < 12) {
    fail("Passphrase is required and must be at least 12 chars.");
  }
  return passphrase;
}

function deriveKey(passphrase: string, saltHex: string, n = 32768, r = 8, p = 1): Buffer {
  // Node 24 can throw ERR_CRYPTO_INVALID_SCRYPT_PARAMS with the default maxmem
  // even for valid N/r/p. Set an explicit safe ceiling above the required memory.
  const requiredBytes = 128 * n * r;
  const maxmem = Math.max(64 * 1024 * 1024, requiredBytes + 1024 * 1024);
  return scryptSync(passphrase, Buffer.from(saltHex, "hex"), 32, { N: n, r, p, maxmem });
}

function encryptSeed(seedHex: string, passphrase: string): Omit<VaultFile, "version" | "network"> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const n = 32768;
  const r = 8;
  const p = 1;
  const key = deriveKey(passphrase, salt.toString("hex"), n, r, p);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(seedHex, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    kdf: {
      algorithm: "scrypt",
      saltHex: salt.toString("hex"),
      n,
      r,
      p
    },
    cipher: {
      algorithm: "aes-256-gcm",
      ivHex: iv.toString("hex"),
      tagHex: tag.toString("hex"),
      ciphertextHex: ciphertext.toString("hex")
    }
  };
}

function decryptSeed(vault: VaultFile, passphrase: string): string {
  const key = deriveKey(passphrase, vault.kdf.saltHex, vault.kdf.n, vault.kdf.r, vault.kdf.p);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(vault.cipher.ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(vault.cipher.tagHex, "hex"));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(vault.cipher.ciphertextHex, "hex")),
    decipher.final()
  ]);
  return clear.toString("utf8");
}

function saveVault(vaultPath: string, payload: VaultFile) {
  const resolved = path.resolve(process.cwd(), vaultPath);
  writeFileSync(resolved, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

function loadVault(vaultPath: string): VaultFile {
  const resolved = path.resolve(process.cwd(), vaultPath);
  if (!existsSync(resolved)) fail(`Vault not found: ${resolved}`);
  const raw = JSON.parse(readFileSync(resolved, "utf8"));
  return VaultSchema.parse(raw);
}

function networkToBitcoin(_network: WalletNetwork) {
  return bitcoin.networks.testnet;
}

function deriveAddressInternal(seedHex: string, network: WalletNetwork, index: number) {
  const seed = Buffer.from(seedHex, "hex");
  const root = bip32.fromSeed(seed, networkToBitcoin(network));
  const child = root.derivePath(`m/84'/1'/0'/0/${index}`);
  if (!child.privateKey) fail("Could not derive private key.");
  const payment = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: networkToBitcoin(network)
  });
  if (!payment.address) fail("Could not derive address.");
  return {
    address: payment.address,
    privateKey: child.privateKey
  };
}

export function initVault(input: { network: WalletNetwork; vaultPath: string; passphrase: string }) {
  const { network, vaultPath } = input;
  const passphrase = ensurePassphrase(input.passphrase);
  if (network !== "signet" && network !== "testnet") {
    fail("Only signet or testnet allowed.");
  }
  if (existsSync(vaultPath)) fail("Vault already exists.");
  const placeholderSeed = Buffer.alloc(32, 0).toString("hex");
  const encrypted = encryptSeed(placeholderSeed, passphrase);
  saveVault(vaultPath, {
    version: 1,
    network,
    ...encrypted
  });
  return { vaultPath, network };
}

export function createWalletSeed(input: {
  vaultPath: string;
  passphrase: string;
  returnMnemonic?: boolean;
}) {
  const passphrase = ensurePassphrase(input.passphrase);
  const existing = loadVault(input.vaultPath);
  const mnemonic = bip39.generateMnemonic(256);
  const seedHex = bip39.mnemonicToSeedSync(mnemonic).toString("hex");
  const encrypted = encryptSeed(seedHex, passphrase);
  saveVault(input.vaultPath, {
    version: 1,
    network: existing.network,
    ...encrypted
  });
  return {
    network: existing.network,
    mnemonic: input.returnMnemonic ? mnemonic : undefined
  };
}

export function deriveWalletAddress(input: { vaultPath: string; passphrase: string; index: number }) {
  const passphrase = ensurePassphrase(input.passphrase);
  if (!Number.isInteger(input.index) || input.index < 0) fail("Index must be a non-negative integer.");
  const vault = loadVault(input.vaultPath);
  const seedHex = decryptSeed(vault, passphrase);
  const { address } = deriveAddressInternal(seedHex, vault.network, input.index);
  return { network: vault.network, index: input.index, address };
}

export function signWalletMessage(input: {
  vaultPath: string;
  passphrase: string;
  index: number;
  message: string;
}) {
  const passphrase = ensurePassphrase(input.passphrase);
  if (!input.message) fail("Message is required.");
  if (!Number.isInteger(input.index) || input.index < 0) fail("Index must be a non-negative integer.");
  const vault = loadVault(input.vaultPath);
  const seedHex = decryptSeed(vault, passphrase);
  const { address, privateKey } = deriveAddressInternal(seedHex, vault.network, input.index);
  const keyPair = ECPair.fromPrivateKey(privateKey, {
    network: networkToBitcoin(vault.network),
    compressed: true
  });
  if (!keyPair.privateKey) fail("Could not access private key.");
  const signature = bitcoinMessage
    .sign(input.message, Buffer.from(keyPair.privateKey), keyPair.compressed)
    .toString("base64");
  return { network: vault.network, index: input.index, address, message: input.message, signature };
}

export function vaultStatus(input: { vaultPath: string }) {
  const vault = loadVault(input.vaultPath);
  return { version: vault.version, network: vault.network, encryption: vault.cipher.algorithm };
}
