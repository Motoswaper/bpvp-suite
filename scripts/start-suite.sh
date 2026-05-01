#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd -P "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dashboard.pid"
LOG_FILE="$RUN_DIR/dashboard.log"
SECRETS_FILE="$RUN_DIR/local-secrets.env"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-bpvp}"
BUILD_ON_START="${AXE_BUILD_ON_START:-false}"
HEALTH_TIMEOUT_SECONDS="${AXE_HEALTH_TIMEOUT_SECONDS:-60}"
HEALTH_POLL_INTERVAL_SECONDS="${AXE_HEALTH_POLL_INTERVAL_SECONDS:-2}"

get_secret() {
  key="$1"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$SECRETS_FILE"
}

wait_for_json_ok() {
  name="$1"
  url="$2"
  timeout="$3"
  interval="$4"
  elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    response="$(curl -fsS "$url" 2>/dev/null || true)"
    case "$response" in
      *'"ok":true'*)
        echo "  ✓ $name ready ($url)"
        return 0
        ;;
    esac
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo "  ✗ $name failed readiness check ($url)"
  return 1
}

wait_for_http_ok() {
  name="$1"
  url="$2"
  timeout="$3"
  interval="$4"
  elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    status_code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
    case "$status_code" in
      200|301|302|307|308)
        echo "  ✓ $name ready ($url)"
        return 0
        ;;
    esac
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done

  echo "  ✗ $name failed readiness check ($url), last status: ${status_code:-none}"
  return 1
}

mkdir -p "$RUN_DIR"
"$ROOT_DIR/scripts/prepare-local-secrets.sh"
chmod 600 "$SECRETS_FILE"

AXE_API_KEY="$(get_secret AXE_API_KEY)"
AXE_HMAC_SECRET="$(get_secret AXE_HMAC_SECRET)"
DASHBOARD_PASSWORD="$(get_secret DASHBOARD_PASSWORD)"
BPVP_ALLOW_PUBLIC_REGISTER_VALUE="${BPVP_ALLOW_PUBLIC_REGISTER:-$(get_secret BPVP_ALLOW_PUBLIC_REGISTER)}"
BPVP_MARKETPLACE_PUBLIC_API_KEY_VALUE="${BPVP_MARKETPLACE_PUBLIC_API_KEY:-$(get_secret BPVP_MARKETPLACE_PUBLIC_API_KEY)}"
BPVP_MARKETPLACE_CORS_ORIGIN_VALUE="${BPVP_MARKETPLACE_CORS_ORIGIN:-$(get_secret BPVP_MARKETPLACE_CORS_ORIGIN)}"
BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS_VALUE="${BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS:-$(get_secret BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS)}"
BPVP_ADMIN_STEPUP_TOKEN_VALUE="${BPVP_ADMIN_STEPUP_TOKEN:-$(get_secret BPVP_ADMIN_STEPUP_TOKEN)}"

if [ -z "$AXE_API_KEY" ] || [ -z "$AXE_HMAC_SECRET" ] || [ -z "$DASHBOARD_PASSWORD" ]; then
  echo "Missing required secrets in $SECRETS_FILE"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not installed."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed."
  exit 1
fi

echo "[1/3] Starting backend stack (engine/indexer/watcher)..."
if [ "$BUILD_ON_START" = "true" ]; then
  docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$SECRETS_FILE" -f "$BACKEND_DIR/docker-compose.yml" up -d --build
else
  docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$SECRETS_FILE" -f "$BACKEND_DIR/docker-compose.yml" up -d
fi

echo "[2/3] Starting dashboard..."
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Dashboard already running (pid $(cat "$PID_FILE"))."
else
  (
    cd "$DASHBOARD_DIR"
    PORT=3100 \
    AXE_API_KEY="$AXE_API_KEY" \
    AXE_HMAC_SECRET="$AXE_HMAC_SECRET" \
    DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD" \
    BPVP_ALLOW_PUBLIC_REGISTER="$BPVP_ALLOW_PUBLIC_REGISTER_VALUE" \
    BPVP_MARKETPLACE_PUBLIC_API_KEY="$BPVP_MARKETPLACE_PUBLIC_API_KEY_VALUE" \
    BPVP_MARKETPLACE_CORS_ORIGIN="$BPVP_MARKETPLACE_CORS_ORIGIN_VALUE" \
    BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS="$BPVP_MARKETPLACE_ALLOWED_WRITE_ORIGINS_VALUE" \
    BPVP_ADMIN_STEPUP_TOKEN="$BPVP_ADMIN_STEPUP_TOKEN_VALUE" \
    npm run dev >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )
fi

echo "[3/4] Waiting for services to become ready..."
readiness_ok=true
wait_for_json_ok "Engine health" "http://localhost:28080/health" "$HEALTH_TIMEOUT_SECONDS" "$HEALTH_POLL_INTERVAL_SECONDS" || readiness_ok=false
wait_for_json_ok "Indexer health" "http://localhost:28081/health" "$HEALTH_TIMEOUT_SECONDS" "$HEALTH_POLL_INTERVAL_SECONDS" || readiness_ok=false
wait_for_json_ok "Watcher health" "http://localhost:28082/health" "$HEALTH_TIMEOUT_SECONDS" "$HEALTH_POLL_INTERVAL_SECONDS" || readiness_ok=false
wait_for_http_ok "Dashboard login" "http://localhost:3100/login" "$HEALTH_TIMEOUT_SECONDS" "$HEALTH_POLL_INTERVAL_SECONDS" || readiness_ok=false

if [ "$readiness_ok" != "true" ]; then
  echo ""
  echo "Startup readiness checks failed. Current backend status:"
  docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$SECRETS_FILE" -f "$BACKEND_DIR/docker-compose.yml" ps || true
  echo ""
  echo "Recent backend logs:"
  docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$SECRETS_FILE" -f "$BACKEND_DIR/docker-compose.yml" logs --tail 40 || true
  echo ""
  echo "Recent dashboard logs:"
  if [ -f "$LOG_FILE" ]; then
    awk 'NR>200{exit} {print}' "$LOG_FILE"
  else
    echo "Dashboard log file not found."
  fi
  exit 1
fi

echo "[4/4] Suite status:"
echo "  Backend: docker compose ps"
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$SECRETS_FILE" -f "$BACKEND_DIR/docker-compose.yml" ps
echo "  Dashboard PID: $(cat "$PID_FILE" 2>/dev/null || echo "not-running")"
echo ""
echo "Open: http://localhost:3100"
echo "Dashboard logs: tail -f \"$LOG_FILE\""
