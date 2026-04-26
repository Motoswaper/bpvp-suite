# AXE Go-Live Checklist

## Security gates

- [ ] `AXE_STRICT_MODE=true` enabled in production services.
- [ ] `AXE_API_KEY` configured per environment.
- [ ] `AXE_HMAC_SECRET` rotated and unique per environment.
- [ ] `DASHBOARD_PASSWORD` configured (no runtime default allowed).
- [ ] Trusted CIDRs configured for control endpoints where required.

## Reliability gates

- [ ] `GET /health` green for engine/indexer/watcher.
- [ ] `GET /ready` green for engine/indexer/watcher.
- [ ] `make self-audit` passes from `backend/`.
- [ ] `make smoke-gates` passes from `backend/`.
- [ ] Journal backup and restore tested in staging.
- [ ] Replay test passes: `go test ./internal/engine -run TestEngineReplayDeterministicStateHash -v`.
- [ ] Indexer status confirms `bitcoinHealthy=true`, expected `confirmations`, and zero unreviewed dead-letter entries.
- [ ] `make dlq-summary FILE=<path-to-dlq>` reviewed and approved (no unexpected permanent failures).

## Observability gates

- [ ] `GET /metrics` returns Prometheus metrics on all services.
- [ ] Request/error counters are non-zero under staging traffic.
- [ ] Alerting wired for readiness failures and high error rates.

## CI/CD gates

- [ ] Backend quality job green (`gofmt`, `go vet`, `go test -race`, `go build`, `govulncheck`).
- [ ] Dashboard quality job green (`tsc`, build, audit).
- [ ] Container scan job green (no HIGH/CRITICAL accepted without waiver).

## Runtime operations gates

- [ ] Runbook validated: `docs/operations.md`.
- [ ] Recovery drill executed within target recovery time.
- [ ] Deployment rollback procedure validated.
