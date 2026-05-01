#!/usr/bin/env sh
set -eu

BASE_ENGINE="${BASE_ENGINE:-http://localhost:28080}"
BASE_INDEXER="${BASE_INDEXER:-http://localhost:28081}"
BASE_WATCHER="${BASE_WATCHER:-http://localhost:28082}"

echo "== BPVP Smoke Gates =="

echo "[1/7] Engine health"
curl -fsS "$BASE_ENGINE/health" >/dev/null

echo "[2/7] Indexer health"
curl -fsS "$BASE_INDEXER/health" >/dev/null

echo "[3/7] Watcher health"
curl -fsS "$BASE_WATCHER/health" >/dev/null

echo "[4/7] Engine ready"
curl -fsS "$BASE_ENGINE/ready" >/dev/null

echo "[5/7] Indexer ready"
curl -fsS "$BASE_INDEXER/ready" >/dev/null

echo "[6/7] Watcher ready"
curl -fsS "$BASE_WATCHER/ready" >/dev/null

echo "[7/7] Core status sanity"
ENGINE_STATUS="$(curl -fsS "$BASE_ENGINE/status")"
INDEXER_STATUS="$(curl -fsS "$BASE_INDEXER/status")"
WATCHER_STATUS="$(curl -fsS "$BASE_WATCHER/status")"

case "$ENGINE_STATUS" in
  *stateHash*) : ;;
  *) echo "missing engine stateHash"; exit 1 ;;
esac

case "$INDEXER_STATUS" in
  *bitcoinHealthy*) : ;;
  *) echo "missing indexer bitcoinHealthy"; exit 1 ;;
esac

case "$WATCHER_STATUS" in
  *actionsPushed*) : ;;
  *) echo "missing watcher actionsPushed"; exit 1 ;;
esac

echo "SMOKE GATES PASS"
