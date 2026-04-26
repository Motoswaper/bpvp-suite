#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dashboard.pid"
LOG_FILE="$RUN_DIR/dashboard.log"

mkdir -p "$RUN_DIR"

echo "[1/3] Starting backend stack (engine/indexer/watcher)..."
docker compose -f "$BACKEND_DIR/docker-compose.yml" up --build -d

echo "[2/3] Starting dashboard..."
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Dashboard already running (pid $(cat "$PID_FILE"))."
else
  (
    cd "$DASHBOARD_DIR"
    AXE_API_KEY="${AXE_API_KEY:-axe-local-dev-key}" \
    DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:-TopClass123!}" \
    npm run dev >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )
fi

echo "[3/3] Suite status:"
echo "  Backend: docker compose ps"
docker compose -f "$BACKEND_DIR/docker-compose.yml" ps
echo "  Dashboard PID: $(cat "$PID_FILE" 2>/dev/null || echo "not-running")"
echo ""
echo "Open: http://localhost:3000"
echo "Dashboard logs: tail -f \"$LOG_FILE\""
