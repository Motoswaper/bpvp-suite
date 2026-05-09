# BPVP Suite

Bitcoin-native DeFi operating layer with modular services for market workflows, identity, trust, lending, settlement, and dashboard operations.

## Monorepo Structure

- `backend/`: Go services (`axe-engine`, `axe-indexer`, `axe-watcher`)
- `dashboard/`: Next.js application for operations, auth, docs, and monitoring
- `bpvp-wallet/`: Desktop wallet client
- `ai-agent/`: Agent-side tooling and integrations
- `external-marketplace-client/`: Marketplace client integration package
- `docs/`: Product, architecture, launch, and governance documentation
- `scripts/`: Operational scripts (health checks, deployment helpers, audits)

**Workspace:** use exactly one local checkout; full paths and freeze steps are in [`docs/CANONICAL_WORKSPACE.md`](docs/CANONICAL_WORKSPACE.md). To bring **local suite + Cloudflare tunnel** online with one command after saving your tunnel token, run `./scripts/online-testnet.sh` from that checkout (see that doc).

## Quick Start

### Backend

```bash
cd backend
go test ./...
go build ./...
```

### Dashboard

```bash
cd dashboard
npm install
npm run build
npm run dev
```

## Security and Code Quality

- Code scanning and dependency automation are enabled through GitHub workflows.
- Container scanning is executed in CI through Trivy SARIF uploads.
- Authentication uses signed sessions and role-based access controls.
- Audit scope, cadence, and policy are documented in `docs/AUDIT_SECURITY_POLICY.md`.
- Security incident severity SLAs are documented in `docs/SECURITY_INCIDENT_RESPONSE_POLICY.md`.
- Risk-to-control mapping is documented in `docs/AUDIT_COVERAGE_MATRIX.md`.
- Keyless provenance signing baseline is automated in `INFO - Provenance Signing`.
- Public read-only access endpoints are documented in `docs/PUBLIC_READ_ONLY_ACCESS.md`.

## Documentation

Module-level and launch documentation lives under `docs/`.

Additional package-level readmes:

- `bpvp-wallet/README.md`
- `ai-agent/README.md`
- `external-marketplace-client/README.md`

## License

No license file is currently defined at repository root.
