#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
REPORT="$RUN_DIR/final-audit-report.txt"
SECRETS_FILE="$RUN_DIR/local-secrets.env"
RPC_ENV_FILE="$ROOT_DIR/backend/.env.rpc"

mkdir -p "$RUN_DIR"
: > "$REPORT"

log() {
  echo "$1" | tee -a "$REPORT"
}

log "== BPVP Final Audit =="
log "timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if [ ! -f "$SECRETS_FILE" ]; then
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    log "CI: generating $SECRETS_FILE via prepare-local-secrets.sh"
    "$ROOT_DIR/scripts/prepare-local-secrets.sh"
    chmod 600 "$SECRETS_FILE"
  else
    log "FAIL: missing $SECRETS_FILE"
    exit 1
  fi
fi

log "[1/8] Ensure local secrets look hardened"
if rg -n "axe-local-dev-key|axe-local-hmac-secret|TopClass123!" "$SECRETS_FILE" >/dev/null 2>&1; then
  log "FAIL: local secrets file still contains weak defaults"
  exit 1
fi

log "[2/8] Security gates"
"$ROOT_DIR/scripts/security-gates.sh" >>"$REPORT" 2>&1

if [ -f "$RPC_ENV_FILE" ]; then
  log "[3/8] Start suite in RPC mode"
  "$ROOT_DIR/scripts/start-suite-rpc.sh" >>"$REPORT" 2>&1
  START_MODE="rpc"
else
  log "[3/8] Start suite in local mode"
  "$ROOT_DIR/scripts/start-suite.sh" >>"$REPORT" 2>&1
  START_MODE="local"
fi

log "[4/8] Wait for services to settle"
sleep 4

if [ "${START_MODE:-local}" = "rpc" ]; then
  INDEXER_STATUS_PRE="$(curl -fsS http://localhost:28081/status 2>/dev/null || true)"
  case "$INDEXER_STATUS_PRE" in
    *'"bitcoinHealthy":false'*)
      log "WARN: RPC mode indexer not healthy; falling back to local mode for deterministic audit."
      "$ROOT_DIR/scripts/start-suite.sh" >>"$REPORT" 2>&1
      sleep 3
      ;;
  esac
fi

log "[5/8] Core smoke gates"
SMOKE_OK=0
SMOKE_ATTEMPTS=6
SMOKE_DELAY=5
i=1
while [ "$i" -le "$SMOKE_ATTEMPTS" ]; do
  if "$ROOT_DIR/scripts/smoke-gates.sh" >>"$REPORT" 2>&1; then
    SMOKE_OK=1
    break
  fi
  log "WARN: smoke gates failed on attempt ${i}/${SMOKE_ATTEMPTS}; retrying in ${SMOKE_DELAY}s"
  sleep "$SMOKE_DELAY"
  i=$((i + 1))
done
if [ "$SMOKE_OK" -ne 1 ]; then
  log "FAIL: smoke gates did not pass after retries"
  exit 1
fi

log "[6/8] Journal integrity verification"
(cd "$ROOT_DIR/backend" && make verify-journal) >>"$REPORT" 2>&1

log "[7/8] Security endpoint sanity"
ENGINE_STATUS="$(curl -fsS http://localhost:28080/status)"
INDEXER_STATUS="$(curl -fsS http://localhost:28081/status)"
WATCHER_STATUS="$(curl -fsS http://localhost:28082/status)"
echo "$ENGINE_STATUS" >>"$REPORT"
echo "$INDEXER_STATUS" >>"$REPORT"
echo "$WATCHER_STATUS" >>"$REPORT"

case "$ENGINE_STATUS" in
  *'"version":"1.0.0-rc1"'*) : ;;
  *) log "FAIL: expected engine rc1 version"; exit 1 ;;
esac
case "$INDEXER_STATUS" in
  *'"indexerHealthy":true'*) : ;;
  *) log "FAIL: expected indexerHealthy true"; exit 1 ;;
esac
case "$WATCHER_STATUS" in
  *'"syncLagHealthy":true'*) : ;;
  *) log "FAIL: expected watcher syncLagHealthy true"; exit 1 ;;
esac

log "[8/8] Dashboard reachable"
curl -fsS -I "http://localhost:3100" >/dev/null

log "[9/9] Final audit PASS"
log "report: $REPORT"
