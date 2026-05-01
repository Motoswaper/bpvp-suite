# BPVP Operations Runbook

## Repo location (macOS)

For unattended **LaunchAgent** / **npm** reliability, keep this checkout **outside `~/Documents`** (Apple TCC). A typical layout is **`~/Developer/AXE/bpvp-suite`**. A symlink **`~/Documents/AXE` → `~/Developer/AXE`** can preserve old paths and IDE roots; core scripts use **`cd -P`** so logs and tooling resolve to the real directory. After moving the tree, run **`./scripts/install-bpvp-watchdog.sh`** again so `BPVP_SUITE_ROOT` in the plist matches the new path.

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

Start full local suite (backend + dashboard):

```bash
./scripts/start-suite.sh
```

Start full local suite in RPC mode (includes bitcoin-core):

```bash
./scripts/start-suite-rpc.sh
```

Stop suite:

```bash
./scripts/stop-suite.sh
```

## Health and readiness

Engine:

```bash
curl -s http://localhost:28080/health
curl -s http://localhost:28080/ready
curl -s http://localhost:28080/status
```

Indexer:

```bash
curl -s http://localhost:28081/health
curl -s http://localhost:28081/ready
curl -s http://localhost:28081/status
```

Watcher:

```bash
curl -s http://localhost:28082/health
curl -s http://localhost:28082/ready
curl -s http://localhost:28082/status
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

## Fixed domain publishing (named Cloudflare tunnel)

Quick tunnel URLs are temporary. For a stable domain:

1. Create a named tunnel in Cloudflare Zero Trust.
2. Export your tunnel token in shell:

```bash
export CF_TUNNEL_TOKEN=<your-token>
export CF_HOSTNAME=demo.yourdomain.com
```

3. Start domain publishing:

```bash
./scripts/publish-domain.sh
```

4. Stop domain publishing:

```bash
./scripts/unpublish-domain.sh
```

## Auto-recovery (watchdog, macOS)

Backend containers use `restart: unless-stopped` in `backend/docker-compose.yml`. The tunnel container is created with `--restart unless-stopped` and `scripts/start-cloudflared-domain.sh` applies the same policy on existing containers.

For **automatic bring-up** after benign failures (dashboard crash, compose stopped, tunnel wedged):

1. After install, edit **`~/.bpvp-suite/watchdog.env`** (created from example or migrated from `.run/watchdog.env`) and set **`CF_HOSTNAME`**; add **`CF_TUNNEL_TOKEN`** only if the agent must **recreate** a removed tunnel container.
2. Install the LaunchAgent (runs `scripts/bpvp-watchdog.sh` every 60 seconds):

```bash
./scripts/install-bpvp-watchdog.sh
```

3. Logs: `.run/watchdog.log`, `.run/watchdog.launchd.out.log`, `.run/watchdog.launchd.err.log`.

macOS **TCC** blocks `launchd` from **executing** shell scripts that live under **Documents** (and similar protected locations). The installer copies a small set of scripts into **`~/.bpvp-suite/bin`** and the LaunchAgent runs that copy with **`BPVP_SUITE_ROOT`** pointing at your real checkout, so the watchdog can run unattended. Re-run **`./scripts/install-bpvp-watchdog.sh`** after `git pull` so the staged copies stay current. For maximum reliability (especially `npm` reading `dashboard/` under Documents), prefer cloning the repo under **`~/Developer`** or similar; if recovery still fails from the agent, grant **Full Disk Access** to **Terminal** (or move the repo) per Apple’s privacy rules.

Behavior summary: **two consecutive failed health checks** (local: four compose services up, dashboard PID alive, `/login` returns HTML containing `BPVP`) trigger `docker compose up -d` then a dashboard restart via `start-suite-rpc.sh`. **At most eight** such recoveries per rolling hour; above that, a **30-minute cooldown** applies so repeated failures do not look like an attack or flap loop. If the **public** URL fails but local checks pass, the watchdog restarts only the **tunnel** container (throttled to once per five minutes by default) and **skips** action when the response looks like a **Cloudflare browser challenge** page.

Manual health probe:

```bash
./scripts/bpvp-healthcheck.sh
```

Remove the LaunchAgent:

```bash
./scripts/uninstall-bpvp-watchdog.sh
```
