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

## Documentation

Module-level and launch documentation lives under `docs/`.

CI policy and gate classification:

- `docs/CI_GATES.md`
- `docs/RELEASE_READINESS.md`

Additional package-level readmes:

- `bpvp-wallet/README.md`
- `ai-agent/README.md`
- `external-marketplace-client/README.md`

## License

No license file is currently defined at repository root.
