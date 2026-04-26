# AXE Operations Runbook

## Service lifecycle

Start all backend services:

```bash
cd backend
docker compose up --build
```

Stop all backend services:

```bash
cd backend
docker compose down --remove-orphans
```

## Health and readiness

Engine:

```bash
curl -s http://localhost:18080/health
curl -s http://localhost:18080/ready
curl -s http://localhost:18080/status
```

Indexer:

```bash
curl -s http://localhost:18081/health
curl -s http://localhost:18081/ready
curl -s http://localhost:18081/status
```

Watcher:

```bash
curl -s http://localhost:18082/health
curl -s http://localhost:18082/ready
curl -s http://localhost:18082/status
```

## Backup and restore

Create journal backup:

```bash
cd backend
make backup-journal
```

Restore journal backup:

```bash
cd backend
make restore-journal FILE=./backups/engine-journal-<timestamp>.ndjson
```

After restore, restart engine:

```bash
cd backend
docker compose restart axe-engine
```

## Incident recovery

1. Confirm failing component with `/ready` and `/status`.
2. Snapshot current journal with `make backup-journal`.
3. Restart only affected service:
   - `docker compose restart axe-engine`
   - `docker compose restart axe-indexer`
   - `docker compose restart axe-watcher`
4. If engine state corruption is suspected, restore previous journal and restart engine.
5. Validate:
   - `/ready` returns `ok: true`
   - `/metrics` still emits request counters
   - `/events` and `/actions` flow resumes
