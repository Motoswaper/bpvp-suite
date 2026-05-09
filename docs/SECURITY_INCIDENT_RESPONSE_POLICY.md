# BPVP Security Incident Response Policy

This policy defines severity levels, response SLAs, and minimum handling standards for security incidents affecting BPVP systems and users.

## 1) Scope

Applies to:

- Production services and APIs.
- Authentication/session integrity events.
- Wallet release artifacts and supply-chain events.
- Data exposure, integrity, or availability threats.

## 2) Severity Classification

### P1 - Critical

Examples:

- Active exploitation in production.
- Unauthorized privileged access.
- Private key, credential, or sensitive data compromise.
- Tampered release artifact or supply-chain compromise.

Target SLA:

- Acknowledge: 15 minutes
- Mitigation start: 30 minutes
- Initial containment: 2 hours
- Public/internal status update cadence: every 60 minutes until contained

### P2 - High

Examples:

- High-confidence vulnerability with realistic exploit path.
- Auth bypass/regression without confirmed active exploitation.
- Security control disabled in production.

Target SLA:

- Acknowledge: 1 hour
- Mitigation start: 4 hours
- Containment/temporary fix: 24 hours
- Update cadence: every 4 hours during active handling

### P3 - Medium

Examples:

- Moderate vulnerabilities without immediate exploit path.
- Hardening gaps, weak defaults, or elevated but non-critical risk.

Target SLA:

- Acknowledge: 1 business day
- Fix plan approved: 3 business days
- Mitigation shipped: 14 calendar days

### P4 - Low

Examples:

- Informational findings and minor hygiene issues.

Target SLA:

- Acknowledge: 3 business days
- Scheduled remediation: next planned hardening cycle

## 3) Mandatory Response Workflow

1. Detect and triage (validate signal, assign severity).
2. Contain impact (disable risky paths, rotate affected secrets, isolate components).
3. Eradicate root cause (code/config fix, dependency or infra remediation).
4. Recover and verify (monitoring confirmation, smoke checks, audit gates).
5. Postmortem and prevention (document timeline, root cause, preventive controls).

## 4) Communication Standard

- Every incident gets an owner and a communication channel.
- P1/P2 require timestamped updates at the cadence above.
- External/public disclosures are coordinated after containment and legal review.

## 5) Evidence and Audit Trail

For every P1-P3 incident, store:

- Detection source and time.
- Impact assessment.
- Mitigation timeline and commands/actions.
- Verification evidence (CI checks, smoke outputs, logs, release checks).
- Final root cause and preventive actions.

## 6) Exit Criteria

An incident is closed only when:

- Immediate risk is contained.
- Root cause is fixed or compensating control is in place.
- Verification checks are green (`REQUIRED`) and monitoring is stable.
- Postmortem and follow-up tasks are recorded with owners.
