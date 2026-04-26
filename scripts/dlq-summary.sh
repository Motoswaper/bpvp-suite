#!/usr/bin/env sh
set -eu

DLQ_FILE="${1:-./backend/data/indexer-dead-letter.ndjson}"

if [ ! -f "$DLQ_FILE" ]; then
  echo "DLQ file not found: $DLQ_FILE"
  exit 1
fi

TOTAL="$(wc -l < "$DLQ_FILE" | tr -d ' ')"
PERMANENT="$(awk -F'\"class\":\"' 'NF>1{split($2,a,\"\\\"\"); if(a[1]==\"permanent\") c++} END{print c+0}' "$DLQ_FILE")"
TRANSIENT="$(awk -F'\"class\":\"' 'NF>1{split($2,a,\"\\\"\"); if(a[1]==\"transient\") c++} END{print c+0}' "$DLQ_FILE")"

echo "DLQ summary"
echo "  file: $DLQ_FILE"
echo "  total: $TOTAL"
echo "  permanent: $PERMANENT"
echo "  transient: $TRANSIENT"
