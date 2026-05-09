#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd -P "$(dirname "$0")/.." && pwd)"

echo "== BPVP full suite restart (stop → start) =="
"$ROOT_DIR/scripts/stop-suite.sh"
"$ROOT_DIR/scripts/start-suite.sh"

echo ""
echo "If you publish via Cloudflare, start the tunnel again (e.g. publish-domain.sh or publish-online.sh)."
