#!/usr/bin/env sh
set -eu

if [ -n "${BPVP_SUITE_ROOT:-}" ]; then
  ROOT_DIR="$BPVP_SUITE_ROOT"
else
  ROOT_DIR="$(cd -P "$(dirname "$0")/.." && pwd)"
fi
BACKEND_DIR="$ROOT_DIR/backend"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dashboard.pid"
LOG_FILE="$RUN_DIR/dashboard.log"
RPC_ENV_FILE="$BACKEND_DIR/.env.rpc"
SECRETS_FILE="$RUN_DIR/local-secrets.env"
RUNTIME_ENV_FILE="$RUN_DIR/rpc-runtime.env"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-bpvp}"

mkdir -p "$RUN_DIR"
HERE="$(cd -P "$(dirname "$0")" && pwd)"
"$HERE/prepare-local-secrets.sh"
AXE_API_KEY="$(awk -F= '$1 == "AXE_API_KEY" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")"
AXE_HMAC_SECRET="$(awk -F= '$1 == "AXE_HMAC_SECRET" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")"
DASHBOARD_PASSWORD="$(awk -F= '$1 == "DASHBOARD_PASSWORD" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")"
BPVP_ALLOW_PUBLIC_REGISTER_VALUE="${BPVP_ALLOW_PUBLIC_REGISTER:-$(awk -F= '$1 == "BPVP_ALLOW_PUBLIC_REGISTER" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")}"
BPVP_ALLOW_PUBLIC_REGISTER_VALUE="${BPVP_ALLOW_PUBLIC_REGISTER_VALUE:-true}"
BPVP_MARKETPLACE_PUBLIC_API_KEY_VALUE="${BPVP_MARKETPLACE_PUBLIC_API_KEY:-$(awk -F= '$1 == "BPVP_MARKETPLACE_PUBLIC_API_KEY" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")}"
BPVP_MARKETPLACE_CORS_ORIGIN_VALUE="${BPVP_MARKETPLACE_CORS_ORIGIN:-$(awk -F= '$1 == "BPVP_MARKETPLACE_CORS_ORIGIN" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")}"
BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS_VALUE="${BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS:-$(awk -F= '$1 == "BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")}"
BPVP_ADMIN_STEPUP_TOKEN_VALUE="${BPVP_ADMIN_STEPUP_TOKEN:-$(awk -F= '$1 == "BPVP_ADMIN_STEPUP_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE")}"

if [ ! -f "$RPC_ENV_FILE" ]; then
  echo "Missing $RPC_ENV_FILE"
  echo "Create it from backend/.env.rpc.example and set RPC credentials."
  exit 1
fi

cat "$SECRETS_FILE" "$RPC_ENV_FILE" > "$RUNTIME_ENV_FILE"

NPM_BIN="${NPM_BIN:-$(command -v npm 2>/dev/null || true)}"
if [ -z "$NPM_BIN" ]; then
  for candidate in /opt/homebrew/bin/npm /usr/local/bin/npm; do
    if [ -x "$candidate" ]; then
      NPM_BIN="$candidate"
      break
    fi
  done
fi

echo "[1/3] Starting backend stack in RPC mode (with bitcoin-core)..."
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$RUNTIME_ENV_FILE" -f "$BACKEND_DIR/docker-compose.yml" up --build -d

echo "[2/3] Starting dashboard..."
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Dashboard already running (pid $(cat "$PID_FILE"))."
else
  if [ -z "$NPM_BIN" ]; then
    echo "npm binary not found (set NPM_BIN or add npm to PATH)."
    exit 1
  fi
  (
    PORT="${PORT:-3100}" \
    BPVP_DOCS_DIR="$ROOT_DIR/docs" \
    BPVP_SESSION_COOKIE_SECURE=false \
    ENGINE_URL="${ENGINE_URL:-http://localhost:28080}" \
    AXE_API_KEY="$AXE_API_KEY" \
    AXE_HMAC_SECRET="$AXE_HMAC_SECRET" \
    DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD" \
    BPVP_ALLOW_PUBLIC_REGISTER="$BPVP_ALLOW_PUBLIC_REGISTER_VALUE" \
    BPVP_MARKETPLACE_PUBLIC_API_KEY="$BPVP_MARKETPLACE_PUBLIC_API_KEY_VALUE" \
    BPVP_MARKETPLACE_CORS_ORIGIN="$BPVP_MARKETPLACE_CORS_ORIGIN_VALUE" \
    BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS="$BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS_VALUE" \
    BPVP_ADMIN_STEPUP_TOKEN="$BPVP_ADMIN_STEPUP_TOKEN_VALUE" \
    NEXT_PUBLIC_BPVP_CHAIN_LABEL="${NEXT_PUBLIC_BPVP_CHAIN_LABEL:-}" \
    "$NPM_BIN" --prefix "$DASHBOARD_DIR" run dev >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )
fi

echo "[3/3] Suite status:"
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$RUNTIME_ENV_FILE" -f "$BACKEND_DIR/docker-compose.yml" ps
echo "Dashboard PID: $(cat "$PID_FILE" 2>/dev/null || echo "not-running")"
echo ""
echo "Open: http://localhost:3100"
echo "Dashboard logs: tail -f \"$LOG_FILE\""
