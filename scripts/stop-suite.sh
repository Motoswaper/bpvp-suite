#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd -P "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dashboard.pid"
SECRETS_FILE="$RUN_DIR/local-secrets.env"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-bpvp}"
CF_CONTAINER="bpvp-cloudflared"
CF_DOMAIN_CONTAINER="bpvp-cloudflared-domain"

echo "[1/2] Stopping backend stack..."
# docker-compose.yml uses ${AXE_API_KEY:?…} / ${AXE_HMAC_SECRET:?…}; Compose still
# interpolates those for `down`. Placeholders satisfy parsing even if .run secrets
# are missing or empty (e.g. after a bad edit).
if [ -f "$SECRETS_FILE" ]; then
  AXE_API_KEY="${AXE_API_KEY:-__compose_down__}" AXE_HMAC_SECRET="${AXE_HMAC_SECRET:-__compose_down__}" \
    docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$SECRETS_FILE" -f "$BACKEND_DIR/docker-compose.yml" down --remove-orphans || true
else
  AXE_API_KEY="${AXE_API_KEY:-__compose_down__}" AXE_HMAC_SECRET="${AXE_HMAC_SECRET:-__compose_down__}" \
    docker compose -p "$COMPOSE_PROJECT_NAME" -f "$BACKEND_DIR/docker-compose.yml" down --remove-orphans || true
fi

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
docker rm -f "$CF_DOMAIN_CONTAINER" >/dev/null 2>&1 || true

echo "Suite stopped."
