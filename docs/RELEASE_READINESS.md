# Release Readiness

Use this to make a fast go/no-go decision before release activities.

## Automated Check

Run:

```bash
./scripts/release-readiness.sh
```

The script writes a timestamped report under `.run/` and prints:

- `PASS` items: healthy signals
- `WARN` items: review recommended
- `FAIL` items: must be fixed before release

Decision output:

- `GO` (no warnings/fails)
- `CONDITIONAL GO` (warnings only)
- `NO-GO` (one or more fails)

## What It Verifies

- Presence of release-critical files and workflows
- Workflow hygiene (no deprecated action pinning in core actions)
- Roles smoke wiring against local runner app and authorize endpoint
- Wallet version/tag consistency signal between:
  - `bpvp-wallet/package.json`
  - `dashboard/app/wallet/page.tsx` default wallet release tag

## Notes

- This is a pre-release guardrail, not a replacement for formal QA/UAT.
- A wallet version/tag mismatch is currently marked as `WARN`, not `FAIL`.
