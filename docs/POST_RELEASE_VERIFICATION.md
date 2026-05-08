# Post-Release Verification

Use this after publishing a wallet tag to confirm the GitHub Release contains installable assets (not only source archives).

## Command

```bash
./scripts/release-verify-assets.sh <tag>
```

Example:

```bash
./scripts/release-verify-assets.sh bpvp-wallet-v0.1.4
```

## What it checks

- Release exists for the requested tag
- Required assets are present:
  - `.exe` (Windows)
  - `.AppImage` and `.deb` (Linux)
  - `.dmg` (macOS)
  - `checksums.txt`
- Asset size is non-zero
- Optional packaging signals (`.zip`, `.tar.gz`, portable build)

## Result

The script writes a report under `.run/` and prints a decision:

- `GO`
- `CONDITIONAL GO`
- `NO-GO`
