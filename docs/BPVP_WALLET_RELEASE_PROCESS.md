# BPVP Wallet Release Process (Installers for Users)

## Goal

Generate downloadable installers per platform so users only need to download and install:

- Windows: `.exe` (NSIS + portable)
- Linux: `AppImage`, `.deb`, `.tar.gz`
- macOS: `.dmg`, `.zip`

## Automated pipeline

Workflow:

- `.github/workflows/bpvp-wallet-release.yml`

Triggers:

- Manual run (`workflow_dispatch`)
- Tag push: `bpvp-wallet-v*`

## How to publish a new installer release

1. Ensure wallet code is stable in `bpvp-wallet/`.
2. Create and push a tag:

```bash
git tag bpvp-wallet-v0.1.0
git push origin bpvp-wallet-v0.1.0
```

3. GitHub Actions builds installers on macOS/Windows/Linux.
4. Artifacts are attached to GitHub Release automatically.

## Download link used by site

Wallet page defaults to the versioned release tag (installers + checksums):

- `https://github.com/Motoswaper/bpvp-suite/releases/tag/bpvp-wallet-v0.1.0`

Optional overrides at **dashboard** build time:

- `NEXT_PUBLIC_BPVP_WALLET_REPO` — default `Motoswaper/bpvp-suite`
- `NEXT_PUBLIC_BPVP_WALLET_TAG` — default `bpvp-wallet-v0.1.0`

## Operational safeguards

- Wallet remains Signet/Testnet oriented for testing.
- Mainnet usage should stay disabled in beta channel.
- Release notes must include checksum/hash verification.

## Checksum verification (automatic)

The release workflow now generates SHA256 checksum files per OS and publishes:

- `checksums-Linux.txt`
- `checksums-Windows.txt`
- `checksums-macOS.txt` (runner naming applies)
- merged `checksums.txt`

Users can verify installers against published hashes before installation.
