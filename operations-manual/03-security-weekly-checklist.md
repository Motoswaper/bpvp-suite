# Security Weekly Checklist (5 minutes)

## Every week

1. GitHub -> Security and quality -> Code scanning
   - confirm open alerts count
   - prioritize `Critical` and `High`

2. GitHub -> Pull requests
   - review Dependabot PRs
   - merge safe patch updates

3. GitHub -> Actions
   - verify latest runs are green for:
     - `AXE CI`
     - `CodeQL`
     - `Gitleaks Secret Scan`
     - `SBOM and Vulnerability Scan`
     - `ZAP Baseline DAST` (scheduled/manual)
     - `Roles Access Smoke` (scheduled/manual)

4. If any red run:
   - open latest run (ignore old historical failures)
   - fix current failure only

## Current automation installed

- CodeQL (SAST)
- Dependabot
- Trivy (container scan via AXE CI)
- Gitleaks
- ZAP baseline
- SBOM + Grype

## Optional role smoke (recommended after auth/CI changes)

```bash
cd "/Users/joubertlopez/Documents/AXE/bpvp-suite"
ADMIN_PASSWORD="YOUR_ADMIN_PASSWORD" BASE_URL="http://127.0.0.1:3100" ./scripts/roles-access-smoke.sh
```

This generates an evidence report under `.run/roles-smoke-*.txt`.

## GitHub automated role smoke

Workflow: `.github/workflows/roles-access-smoke.yml`

Prerequisite secret (repo settings -> Secrets and variables -> Actions):
- `BPVP_ADMIN_PASSWORD`

Manual run:
- Actions -> `Roles Access Smoke` -> Run workflow
- set `base_url` (default: `https://testnet.btc-defi.com`)

