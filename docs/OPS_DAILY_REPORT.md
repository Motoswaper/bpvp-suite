# Ops Daily Report

Run one command to generate an operational status report:

```bash
./scripts/ops-daily-report.sh
```

The report is saved under `.run/ops-daily-report-*.txt`.

## What it verifies

- Local endpoint health:
  - Engine `/health`
  - Indexer `/health`
  - Watcher `/health`
  - Dashboard `/login`
- Wallet version consistency:
  - `bpvp-wallet/package.json` version
  - dashboard default wallet release tag
- Latest configured wallet tag release assets:
  - Calls `scripts/release-verify-assets.sh <tag>`

## Decision output

- `GO`
- `CONDITIONAL GO`
- `NO-GO`

Use this report as a quick daily snapshot before operating changes or launch activities.
