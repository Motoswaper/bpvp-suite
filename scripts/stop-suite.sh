#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dashboard.pid"
CF_CONTAINER="axe-cloudflared"

echo "[1/2] Stopping backend stack..."
docker compose -f "$BACKEND_DIR/docker-compose.yml" down --remove-orphans

echo "[2/2] Stopping dashboard..."
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
  fi
  rm -f "$PID_FILE"
  echo "Dashboard stopped."
else
  echo "Dashboard pid file not found (already stopped)."
fi

docker rm -f "$CF_CONTAINER" >/dev/null 2>&1 || true

echo "Suite stopped."
