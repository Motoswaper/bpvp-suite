# BPVP Wallet Core (Signet/Testnet Only)

This is the BPVP wallet core CLI for secure Bitcoin testing workflows.

## Security posture

- Test networks only (`signet` or `testnet`)
- Encrypted local vault (AES-256-GCM + scrypt key derivation)
- No automatic mainnet support
- No seed phrase persisted in plain text
- Passphrase minimum: 12 characters (recommended: upper+lower+number+symbol)
- Address types supported: `p2wpkh`, `p2tr` (Taproot), `p2sh-p2wpkh`, `p2pkh`

## Quick start

```bash
cd bpvp-wallet
npm install
npm run build
```

Initialize encrypted vault:

```bash
node dist/index.js init --network signet --vault .bpvp-wallet.vault --passphrase "your-long-passphrase" --address-type p2tr
```

Create wallet seed and show mnemonic once:

```bash
node dist/index.js create --vault .bpvp-wallet.vault --passphrase "your-long-passphrase" --show-mnemonic
```

Derive address:

```bash
node dist/index.js derive --vault .bpvp-wallet.vault --passphrase "your-long-passphrase" --index 0 --address-type p2tr
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
