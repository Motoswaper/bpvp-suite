import {
  createWalletSeed,
  deriveWalletAddress,
  initVault,
  signWalletMessage,
  vaultStatus
} from "./core.js";
import type { AddressType, WalletNetwork } from "./core.js";

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function fail(msg: string): never {
  throw new Error(msg);
}

function parseAddressTypeArg(): AddressType {
  return (parseArg("--address-type") ?? "p2wpkh") as AddressType;
}

function cmdInit() {
  const network = (parseArg("--network") ?? "signet") as WalletNetwork;
  const vaultPath = parseArg("--vault") ?? ".bpvp-wallet.vault";
  const passphrase = parseArg("--passphrase") ?? "";
  const defaultAddressType = parseAddressTypeArg();
  initVault({ network, vaultPath, passphrase, defaultAddressType });
  console.log(`Vault initialized: ${vaultPath} (${network}, default address type: ${defaultAddressType})`);
}

function cmdCreate() {
  const vaultPath = parseArg("--vault") ?? ".bpvp-wallet.vault";
  const passphrase = parseArg("--passphrase") ?? "";
  const showMnemonic = hasFlag("--show-mnemonic");
  const created = createWalletSeed({ vaultPath, passphrase, returnMnemonic: showMnemonic });
  console.log(`Wallet seed created for ${created.network}.`);
  if (showMnemonic) {
    console.log("Mnemonic (store offline, never share):");
    console.log(created.mnemonic);
  } else {
    console.log("Use --show-mnemonic once if you need backup phrase display.");
  }
}

function cmdDerive() {
  const vaultPath = parseArg("--vault") ?? ".bpvp-wallet.vault";
  const passphrase = parseArg("--passphrase") ?? "";
  const addressType = parseAddressTypeArg();
  const index = Number(parseArg("--index") ?? "0");
  const derived = deriveWalletAddress({ vaultPath, passphrase, index, addressType });
  console.log(JSON.stringify(derived, null, 2));
}

function cmdSignMessage() {
  const vaultPath = parseArg("--vault") ?? ".bpvp-wallet.vault";
  const passphrase = parseArg("--passphrase") ?? "";
  const message = parseArg("--message");
  const addressType = parseAddressTypeArg();
  const index = Number(parseArg("--index") ?? "0");
  if (!message) fail("Message is required via --message.");
  const signed = signWalletMessage({ vaultPath, passphrase, index, addressType, message });
  console.log(JSON.stringify(signed, null, 2));
}

function cmdStatus() {
  const vaultPath = parseArg("--vault") ?? ".bpvp-wallet.vault";
  console.log(JSON.stringify(vaultStatus({ vaultPath }), null, 2));
}

function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "init":
      return cmdInit();
    case "create":
      return cmdCreate();
    case "derive":
      return cmdDerive();
    case "sign-message":
      return cmdSignMessage();
    case "status":
      return cmdStatus();
    default:
      console.log("Usage:");
      console.log("  init --network signet|testnet --vault .bpvp-wallet.vault --passphrase <secret> [--address-type p2wpkh|p2tr|p2sh-p2wpkh|p2pkh]");
      console.log("  create --vault .bpvp-wallet.vault --passphrase <secret> [--show-mnemonic]");
      console.log("  derive --vault .bpvp-wallet.vault --passphrase <secret> --index 0 [--address-type p2wpkh|p2tr|p2sh-p2wpkh|p2pkh]");
      console.log("  sign-message --vault .bpvp-wallet.vault --passphrase <secret> --index 0 --message \"...\" [--address-type ...]");
      console.log("  status --vault .bpvp-wallet.vault");
      console.log("");
      console.log("Passphrase rules:");
      console.log("  - Minimum 12 characters");
      console.log("  - Recommended: uppercase + lowercase + number + symbol");
      process.exit(1);
  }
}

main();
