#!/usr/bin/env sh
set -eu

if [ $# -lt 1 ]; then
  echo "usage: $0 <backup-file.ndjson>"
  exit 1
fi

BACKUP_FILE="$1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "backup file not found: $BACKUP_FILE"
  exit 1
fi

ENGINE_CONTAINER="$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q axe-engine)"
if [ -z "$ENGINE_CONTAINER" ]; then
  echo "axe-engine container not running"
  exit 1
fi

docker cp "$BACKUP_FILE" "$ENGINE_CONTAINER:/var/lib/axe/engine-journal.ndjson"
echo "journal restored from: $BACKUP_FILE"
