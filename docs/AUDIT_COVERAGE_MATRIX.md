# BPVP Audit Coverage Matrix

This matrix maps major risk categories to automated controls currently in place and identifies planned gaps.

## Current Coverage

| Risk category | Primary controls | Workflow(s) | Coverage status |
|---|---|---|---|
| Source-code vulnerabilities | SAST | `INFO - CodeQL`, `INFO - Semgrep SAST` | Covered |
| Secret leakage | Secret scanning | `INFO - Gitleaks Secret Scan` | Covered |
| Dependency CVEs | SBOM + CVE scanners | `INFO - SBOM and Vulnerability Scan`, `INFO - OSV Dependency Scan`, Dependabot | Covered |
| Container image vulnerabilities | Image scanning | `INFO - Container Security Scan` | Covered |
| IaC / config misconfiguration | Policy scan | `INFO - Checkov IaC Scan` | Covered |
| GitHub Actions workflow security | Workflow lint | `INFO - GitHub Actions Security Lint` | Covered |
| Web attack surface (unauthenticated) | DAST baseline | `INFO - ZAP Baseline DAST` | Covered (baseline) |
| Public availability regression | Smoke checks | `INFO - Public Site Smoke` | Covered |
| Browser hardening headers/CSP | Header smoke checks | `INFO - Security Headers Smoke` | Covered |
| RBAC regression | Role smoke checks | `REQUIRED - Roles Access Smoke` | Covered (required gate) |
| Supply-chain posture | Scorecards + keyless manifest signing | `INFO - OSSF Scorecards`, `INFO - Provenance Signing` | Covered |
| Overall audit observability | Consolidated report | `INFO - Audit Weekly Report` | Covered |

## Operational Gates

- Merge-blocking quality/security gates are enforced by `REQUIRED - AXE CI` and `REQUIRED - Roles Access Smoke`.
- Informational controls (`INFO - ...`) remain non-blocking but must be triaged and tracked.

## Known Gaps (Planned)

1. Authenticated DAST/fuzz testing against protected endpoints.
2. Runtime anomaly detection policy tied to incident auto-escalation.
3. Expand signed provenance verification from manifest-level to full release artifact set in CI.
4. Periodic threat-model refresh artifacts tied to roadmap changes.
