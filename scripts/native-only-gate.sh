#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS_FILE="$ROOT_DIR/.run/local-secrets.env"

echo "== BPVP Native-Only Gate =="

ALLOW_BRIDGE="${BPVP_ALLOW_BRIDGE_IN_PROD:-false}"
ENABLE_BRIDGE_ENV="${BPVP_ENABLE_BRIDGE:-false}"
ENABLE_BRIDGE_UI_ENV="${NEXT_PUBLIC_BPVP_ENABLE_BRIDGE:-false}"

if [ -f "$SECRETS_FILE" ]; then
  # Load local runtime flags if present.
  BPVP_ENABLE_BRIDGE_FILE="$(awk -F= '$1=="BPVP_ENABLE_BRIDGE"{print $2}' "$SECRETS_FILE" | tr -d '\r' || true)"
  NEXT_PUBLIC_BPVP_ENABLE_BRIDGE_FILE="$(awk -F= '$1=="NEXT_PUBLIC_BPVP_ENABLE_BRIDGE"{print $2}' "$SECRETS_FILE" | tr -d '\r' || true)"
else
  BPVP_ENABLE_BRIDGE_FILE=""
  NEXT_PUBLIC_BPVP_ENABLE_BRIDGE_FILE=""
fi

is_true() {
  v="$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  [ "$v" = "1" ] || [ "$v" = "true" ] || [ "$v" = "yes" ] || [ "$v" = "on" ]
}

if is_true "$ALLOW_BRIDGE"; then
  echo "WARN: bridge override allowed by BPVP_ALLOW_BRIDGE_IN_PROD=true"
  echo "NATIVE-ONLY GATE BYPASSED (EXPLICIT OVERRIDE)"
  exit 0
fi

if is_true "$ENABLE_BRIDGE_ENV"; then
  echo "FAIL: BPVP_ENABLE_BRIDGE is enabled without explicit override."
  exit 1
fi

if is_true "$ENABLE_BRIDGE_UI_ENV"; then
  echo "FAIL: NEXT_PUBLIC_BPVP_ENABLE_BRIDGE is enabled without explicit override."
  exit 1
fi

if is_true "$BPVP_ENABLE_BRIDGE_FILE"; then
  echo "FAIL: .run/local-secrets.env has BPVP_ENABLE_BRIDGE=true without explicit override."
  exit 1
fi

if is_true "$NEXT_PUBLIC_BPVP_ENABLE_BRIDGE_FILE"; then
  echo "FAIL: .run/local-secrets.env has NEXT_PUBLIC_BPVP_ENABLE_BRIDGE=true without explicit override."
  exit 1
fi

echo "NATIVE-ONLY GATE PASS"
