# BPVP Audit and Security Policy

This document explains the security and quality audits that BPVP runs, what they cover, and what they do not cover.

The goal is transparency for contributors and users: security checks are continuous, repeatable, and visible in CI, but they are not a substitute for periodic expert manual audits.

## 1) Audit model

BPVP uses a layered audit model:

1. Pre-merge and main-branch automated checks in GitHub Actions.
2. Scheduled recurring scans for drift and newly disclosed vulnerabilities.
3. Operational smoke checks to validate real availability and role controls.
4. Manual expert reviews for logic flaws and cryptographic safety.

## 2) Automated audits currently enforced

### Required gates (must pass for healthy delivery)

- `REQUIRED - AXE CI`
  - Backend quality gates (`go vet`, tests, build).
  - Dashboard quality gates (type check, build).
  - Security and immutability gates (`scripts/security-gates.sh`).
- `REQUIRED - Roles Access Smoke`
  - Verifies role-based access behavior in the dashboard API flow.

### Informational gates (non-blocking, high-signal monitoring)

- `INFO - CodeQL` (static application security testing / SAST).
- `INFO - Gitleaks Secret Scan` (secret exposure detection).
- `INFO - SBOM and Vulnerability Scan` (inventory + CVE scan via Grype).
- `INFO - Container Security Scan` (Trivy image scanning).
- `INFO - ZAP Baseline DAST` (public HTTP surface baseline probing).
- `INFO - Public Site Smoke` (public availability sanity checks).
- `INFO - Dependency Review` (PR dependency risk deltas).
- `INFO - OSSF Scorecards` (supply-chain and repo security posture).

## 3) Scope and coverage

These audits are designed to detect:

- Common coding vulnerabilities and unsafe patterns.
- Leaked secrets and risky dependency changes.
- Known CVEs in dependencies and container stacks.
- Public-facing endpoint regressions.
- CI/CD and repository hardening regressions.

These audits are not designed to fully detect:

- Complex business-logic abuse paths.
- Deep authenticated penetration scenarios.
- Full cryptographic/protocol correctness.
- Cloud account misconfiguration beyond repository CI checks.
- Legal/compliance certification requirements by themselves.

## 4) Manual audits that remain necessary

At least quarterly (or before major releases), BPVP should run:

- Authenticated penetration testing of role and session boundaries.
- Threat modeling for critical flows (auth, wallet, bridge, admin ops).
- Wallet/client security review (signing, update chain, artifact trust).
- Incident-response tabletop simulation and recovery drills.

## 5) Severity and response policy

- `REQUIRED` failures: immediate stop for release progression until fixed.
- `INFO` failures: triage and track with ownership and due date.
- Critical/high confirmed findings: patch priority and accelerated release.

## 6) Disclosure and transparency

Public CI results are visible in the repository Actions and Security tabs.
For sensitive findings, remediation details may be delayed until fix deployment.

## 7) Continuous improvement commitments

BPVP will continue improving automated coverage by:

- Expanding authenticated security tests.
- Tightening dependency and supply-chain provenance controls.
- Improving signal quality and reducing false positives in CI.
