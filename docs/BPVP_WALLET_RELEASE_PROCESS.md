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

- Tag push: `bpvp-wallet-v*` — **this is what publishes installers** to the GitHub Release.
- Manual run (`workflow_dispatch`) — builds installers as workflow artifacts only; the **publish** step runs on **tag** events so ad-hoc runs do not attach binaries to a release.

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

## If the release only shows “Source code (zip/tar.gz)”

Older workflow versions used `action-gh-release` with a broad glob; **filenames with spaces** (for example `BPVP Wallet-0.1.0-arm64.dmg`) often did not upload, so GitHub only showed the default source archives.

After fixing `.github/workflows/bpvp-wallet-release.yml`, publish again:

1. Merge the workflow fix to `main`.
2. Bump the tag and push (example patch):

```bash
git tag -d bpvp-wallet-v0.1.1 2>/dev/null || true
git push origin :refs/tags/bpvp-wallet-v0.1.1 2>/dev/null || true
git tag bpvp-wallet-v0.1.1
git push origin bpvp-wallet-v0.1.1
```

3. Update `NEXT_PUBLIC_BPVP_WALLET_TAG` (or the default in `dashboard/app/wallet/page.tsx`) if you change the tag string.

Optional: delete the empty **GitHub Release** for the old tag in the UI (keep the git tag or delete it if you no longer want that version public).
