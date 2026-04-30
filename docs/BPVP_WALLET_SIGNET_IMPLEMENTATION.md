# BPVP Wallet (Signet/Testnet) - Implementation Baseline

## Objective

Create BPVP-branded wallet capability for controlled Bitcoin testing without touching mainnet or real assets.

## Current baseline enabled

- Public portal: `/wallet`
- Download entries for macOS/Windows/Linux under `/downloads/*`
- Test-only operating policy in UI copy
- Existing challenge/sign/verify wallet link in Profile

## Safety constraints (non-negotiable)

- No mainnet transactions in beta flow
- No production key reuse
- Explicit testnet/signet labeling everywhere
- Logs and session checks for linking actions

## Next implementation phases

### Phase 1 (done now)

- Delivery portal and secure testing flow documentation

### Phase 2

- Native Bitcoin message signing support (BIP-322/PSBT compatible flow)
- Wallet provider detection for Bitcoin wallets
- Address/network validation (Signet/Testnet only)

### Phase 3

- BPVP Wallet desktop/mobile branded clients
- Auto-update channels
- Hardened key management and secure storage

### Phase 4

- End-to-end Signet certification runbook
- Conformance suite for wallet-link + module transaction tests
