# BPVP Operations Runbook

## Repo location (macOS)

For unattended **LaunchAgent** / **npm** reliability, keep this checkout **outside `~/Documents`** (Apple TCC). A typical layout is **`~/Developer/AXE/bpvp-suite`**. A symlink **`~/Documents/AXE` → `~/Developer/AXE`** can preserve old paths and IDE roots; core scripts use **`cd -P`** so logs and tooling resolve to the real directory. After moving the tree, run **`./scripts/install-bpvp-watchdog.sh`** again so `BPVP_SUITE_ROOT` in the plist matches the new path.

## Service lifecycle

Start backend via Compose **only** if you already export `AXE_API_KEY`, `AXE_HMAC_SECRET`, and use project `bpvp` + env file (see `start-suite.sh`). For normal local work, use **`./scripts/start-suite.sh`** instead.

Raw compose (advanced):

```bash
cd backend
docker compose -p bpvp --env-file ../.run/local-secrets.env up --build -d
```

Stop that stack:

```bash
cd backend
docker compose -p bpvp --env-file ../.run/local-secrets.env down --remove-orphans
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

Restart everything (Docker stack + dashboard; also removes quick/domain Cloudflare tunnel containers — run your publish script again after):

```bash
./scripts/restart-suite.sh
```

If **`Missing required secrets in .run/local-secrets.env`** appears, the file is missing lines or was emptied. Regenerate (this deletes the old file):

```bash
rm -f .run/local-secrets.env
./scripts/prepare-local-secrets.sh
chmod 600 .run/local-secrets.env
./scripts/start-suite.sh
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

## Expose the dashboard (Cloudflare tunnel)

**Always do this in order:** local stack first, tunnel second. The dashboard must answer on **`http://127.0.0.1:3100`** before any tunnel makes sense.

### 0) One-time: working directory and secrets

```bash
cd /path/to/bpvp-suite    # real path; symlinks resolve with scripts’ cd -P
./scripts/start-suite.sh   # or ./scripts/restart-suite.sh — creates .run/local-secrets.env if missing
```

If secrets are broken, see **“Missing required secrets”** earlier in this file.

### 1) Quick public URL (temporary `*.trycloudflare.com`)

Starts suite (if needed), waits for **:3100**, then runs a **quick** tunnel (container `bpvp-cloudflared`):

```bash
./scripts/publish-online.sh
```

It prints **PUBLIC URL** and saves it to `.run/cloudflared.url`.  
Stop: `./scripts/stop-suite.sh` (also removes tunnel containers) or `docker rm -f bpvp-cloudflared`.

### 2) Fixed hostname (e.g. `testnet.btc-defi.com`)

Requires a **named tunnel** in [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) and a **Public hostname** on that tunnel pointing at your origin (the connector must reach the Mac; the repo uses **`http://host.docker.internal:3100`** inside Docker).

**Option A — all-in-one (RPC suite + tunnel recreate)** — needs `backend/.env.rpc` for `start-suite-rpc.sh`:

```bash
export CF_TUNNEL_TOKEN='<paste tunnel token from Cloudflare>'
export CF_HOSTNAME=testnet.btc-defi.com
./scripts/publish-domain.sh
```

**Option B — suite already running** (mock or RPC already up; only (re)start tunnel):

```bash
export CF_TUNNEL_TOKEN='<paste tunnel token>'
export CF_HOSTNAME=testnet.btc-defi.com
# After ./scripts/stop-suite.sh removed the tunnel container, force recreate:
BPVP_TUNNEL_RECREATE=1 ./scripts/start-cloudflared-domain.sh
# If the container already exists and is stopped:
# ./scripts/start-cloudflared-domain.sh
```

Container name: **`bpvp-cloudflared-domain`**. Logs: `docker logs -f bpvp-cloudflared-domain`.

**DNS:** `testnet.btc-defi.com` must be the hostname configured on the tunnel in Cloudflare (CNAME/proxy as Cloudflare shows).

Stop tunnel + suite cleanup: `./scripts/stop-suite.sh` or `./scripts/unpublish-domain.sh` where applicable.

### 3) Checklist if you see **502 Bad Gateway**

1. `curl -sI http://127.0.0.1:3100/login` — must not fail.  
2. `docker ps` — tunnel container running.  
3. `docker logs --tail 80 bpvp-cloudflared-domain` (or `bpvp-cloudflared`) — look for connection errors to **3100**.  
4. Mac awake; Docker Desktop running.

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
