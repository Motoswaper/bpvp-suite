# BPVP Wallet Core (Signet/Testnet Only)

This is the BPVP wallet core CLI for secure Bitcoin testing workflows.

## Security posture

- Test networks only (`signet` or `testnet`)
- Encrypted local vault (AES-256-GCM + scrypt key derivation)
- No automatic mainnet support
- No seed phrase persisted in plain text

## Quick start

```bash
cd bpvp-wallet
npm install
npm run build
```

Initialize encrypted vault:

```bash
node dist/index.js init --network signet --vault .bpvp-wallet.vault --passphrase "your-long-passphrase"
```

Create wallet seed and show mnemonic once:

```bash
node dist/index.js create --vault .bpvp-wallet.vault --passphrase "your-long-passphrase" --show-mnemonic
```

Derive address:

```bash
node dist/index.js derive --vault .bpvp-wallet.vault --passphrase "your-long-passphrase" --index 0
```

Sign challenge message:

```bash
node dist/index.js sign-message --vault .bpvp-wallet.vault --passphrase "your-long-passphrase" --index 0 --message "BPVP wallet link nonce: abc123"
```

## Desktop beta (Electron)

Run desktop UI:

```bash
cd bpvp-wallet
npm install
npm run desktop:start
```

Desktop beta includes:

- encrypted vault init
- seed creation
- address derivation
- challenge message signing

All operations are constrained to Signet/Testnet.

## Notes

- `signet` and `testnet` share testnet address format (`tb1...`, `m/n/...`, `2...`).
- This is a secure wallet core baseline, not a full desktop/mobile wallet UI yet.
