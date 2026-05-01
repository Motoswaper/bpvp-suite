#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
CF_CONTAINER="bpvp-cloudflared"

echo "[1/2] Stopping Cloudflare tunnel..."
docker rm -f "$CF_CONTAINER" >/dev/null 2>&1 || true

echo "[2/2] Cleaning publish artifacts..."
rm -f "$RUN_DIR/cloudflared.url" "$RUN_DIR/cloudflared.log"

echo "Unpublished. Local services are unchanged."
