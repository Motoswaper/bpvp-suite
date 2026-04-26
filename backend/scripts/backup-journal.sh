#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${1:-$ROOT_DIR/backups}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/engine-journal-$TS.ndjson"

mkdir -p "$BACKUP_DIR"

ENGINE_CONTAINER="$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q axe-engine)"
if [ -z "$ENGINE_CONTAINER" ]; then
  echo "axe-engine container not running"
  exit 1
fi

docker cp "$ENGINE_CONTAINER:/var/lib/axe/engine-journal.ndjson" "$OUT_FILE"
echo "backup created: $OUT_FILE"
