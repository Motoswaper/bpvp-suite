#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
CF_LOG="$RUN_DIR/cloudflared.log"
CF_URL_FILE="$RUN_DIR/cloudflared.url"
CF_CONTAINER="axe-cloudflared"

mkdir -p "$RUN_DIR"

echo "[1/4] Starting local AXE suite..."
"$ROOT_DIR/scripts/start-suite.sh" >/dev/null

echo "[2/4] Waiting for dashboard (localhost:3000)..."
for i in $(seq 1 30); do
  if curl -fsS -I "http://localhost:3000" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "Dashboard did not become reachable on localhost:3000"
    exit 1
  fi
done

echo "[3/4] Starting Cloudflare tunnel container..."
docker rm -f "$CF_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CF_CONTAINER" cloudflare/cloudflared:latest \
  tunnel --no-autoupdate --url http://host.docker.internal:3000 >/dev/null

echo "[4/4] Waiting for public URL..."
URL=""
for i in $(seq 1 45); do
  docker logs "$CF_CONTAINER" >"$CF_LOG" 2>&1 || true
  URL="$(awk '/trycloudflare.com/{for(i=1;i<=NF;i++){if($i ~ /^https:\/\/.*trycloudflare.com$/){print $i; exit}}}' "$CF_LOG" || true)"
  if [ -n "$URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Could not obtain Cloudflare public URL. Check logs:"
  echo "  docker logs $CF_CONTAINER"
  exit 1
fi

printf "%s\n" "$URL" >"$CF_URL_FILE"
echo "PUBLIC URL: $URL"
echo "Saved URL to: $CF_URL_FILE"
echo "Cloudflare logs: $CF_LOG"
