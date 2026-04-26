# AXE Market Suite v1.0.0-rc1

## Highlights

- Deterministic engine state with persisted journal replay and state hashing.
- Hardened service security with API key + HMAC signature verification.
- Operational readiness endpoints (`/health`, `/ready`) and Prometheus metrics (`/metrics`).
- Indexer resilience:
  - checkpoint resume,
  - canonical chain hash tracking,
  - reorg rollback loop,
  - confirmation-gated ingestion,
  - dead-letter capture for failed heights.
- Journal integrity:
  - tamper-evident hash chain per entry,
  - offline verifier command (`make verify-journal`).
- Watcher resilience:
  - sync lag health signal included in readiness.
- Dashboard authentication with secure cookie session and env-configured password.

## Breaking security changes

- Dashboard login requires `DASHBOARD_PASSWORD` (no fallback default).
- Strict mode can enforce required secrets (`AXE_STRICT_MODE=true`).

## Launch gating references

- `docs/release-checklist.md`
- `docs/operations.md`
- `backend/.env.production.example`
- `dashboard/.env.production.example`
