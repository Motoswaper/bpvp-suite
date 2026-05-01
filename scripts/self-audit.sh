#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
RUN_DIR="$ROOT_DIR/.run"
REPORT="$RUN_DIR/self-audit-report.txt"

mkdir -p "$RUN_DIR"
: > "$REPORT"

log() {
  echo "$1" | tee -a "$REPORT"
}

log "== BPVP Self Audit =="
log "timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

log "[1/6] Start full suite"
"$ROOT_DIR/scripts/start-suite.sh" >>"$REPORT" 2>&1

log "[2/6] Wait for services to settle"
sleep 4

log "[3/6] Backend smoke gates"
(cd "$BACKEND_DIR" && make smoke-gates) >>"$REPORT" 2>&1

log "[4/6] Journal integrity verification"
(cd "$BACKEND_DIR" && make verify-journal) >>"$REPORT" 2>&1

log "[5/6] Core API sanity"
ENGINE_STATUS="$(curl -fsS http://localhost:28080/status)"
INDEXER_STATUS="$(curl -fsS http://localhost:28081/status)"
WATCHER_STATUS="$(curl -fsS http://localhost:28082/status)"
echo "$ENGINE_STATUS" | tee -a "$REPORT" >/dev/null
echo "$INDEXER_STATUS" | tee -a "$REPORT" >/dev/null
echo "$WATCHER_STATUS" | tee -a "$REPORT" >/dev/null

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
  *) log "FAIL: expected syncLagHealthy true"; exit 1 ;;
esac

log "[6/6] Self audit PASS"
log "report: $REPORT"
