# CI Gates and Check Policy

This document defines which GitHub checks are expected to block merges and which are informational.

## Required Merge Gates (main branch)

These checks should be green before merging into `main`:

- `REQUIRED - AXE CI / REQUIRED - Backend Quality Gates`
- `REQUIRED - AXE CI / REQUIRED - Dashboard Quality Gates`
- `REQUIRED - AXE CI / REQUIRED - Security and Immutability Gates`
- `REQUIRED - Roles Access Smoke / REQUIRED - Validate role access controls` (manual/scheduled operational gate)

## Informational / Non-Blocking Checks

These checks are valuable but may fail due to ecosystem noise or external constraints; they should be reviewed, not used as hard blockers by default:

- `REQUIRED - AXE CI / INFO - Container Security Scan` (Trivy findings uploaded as SARIF)
- `REQUIRED - AXE CI / INFO - Release Readiness (Final Audit)` (runs with `continue-on-error`)
- `INFO - CodeQL` (security analysis workflow)
- `INFO - Gitleaks Secret Scan` (currently runs with `continue-on-error`)
- `INFO - SBOM and Vulnerability Scan` (Grype SARIF upload)
- `INFO - ZAP Baseline DAST` (scheduled public-surface scan)

## Operational Rule of Thumb

- **If a required gate is red:** fix first, then merge.
- **If an informational check is red:** triage findings and open a follow-up issue/PR when needed.
- **For role authorization reliability:** keep `Roles Access Smoke` bound to local runner app (`127.0.0.1`) rather than public testnet endpoint.

## Suggested Branch Protection Alignment

In GitHub branch protection for `main`, set only required checks from the "Required Merge Gates" list as mandatory.
