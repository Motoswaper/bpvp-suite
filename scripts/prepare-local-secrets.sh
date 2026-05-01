#!/usr/bin/env sh
set -eu

if [ -n "${BPVP_SUITE_ROOT:-}" ]; then
  ROOT_DIR="$BPVP_SUITE_ROOT"
else
  ROOT_DIR="$(cd -P "$(dirname "$0")/.." && pwd)"
fi
RUN_DIR="$ROOT_DIR/.run"
SECRETS_FILE="$RUN_DIR/local-secrets.env"

mkdir -p "$RUN_DIR"

if [ -f "$SECRETS_FILE" ]; then
  exit 0
fi

API_KEY="$(openssl rand -hex 24)"
HMAC_SECRET="$(openssl rand -hex 32)"
DASHBOARD_PASSWORD="$(openssl rand -base64 24 | tr -d '\n' | tr '/+' '_-')"

cat > "$SECRETS_FILE" <<EOF
AXE_API_KEY=$API_KEY
AXE_HMAC_SECRET=$HMAC_SECRET
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
EOF

chmod 600 "$SECRETS_FILE"
echo "Generated local secrets at $SECRETS_FILE"
