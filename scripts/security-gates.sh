#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "== BPVP Security Gates =="

echo "[1/6] Checking forbidden weak secrets in repository..."
TMP_LIST="$(mktemp)"
TMP_FILTERED="$(mktemp)"
git ls-files > "$TMP_LIST"
# Strip grep(1) line numbers from "git ls-files | grep -n" output, exclude docs/examples,
# and skip these scripts — they contain the forbidden strings only as regex literals.
grep -n -E -v "(\.env\..*example|\.md$)" "$TMP_LIST" | cut -d: -f2- | \
  grep -vE '^(scripts/security-gates\.sh|scripts/final-audit\.sh)$' > "$TMP_FILTERED" || true
if [ -s "$TMP_FILTERED" ] && xargs grep -n -E "axe-local-dev-key|axe-local-hmac-secret|TopClass123!|replace-rpc-user|replace-rpc-pass" < "$TMP_FILTERED" >/dev/null 2>&1; then
  rm -f "$TMP_LIST" "$TMP_FILTERED"
  echo "FAIL: weak/default secrets found in repository files."
  echo "Allowed only in example/docs files."
  exit 1
fi
rm -f "$TMP_LIST" "$TMP_FILTERED"

echo "[2/6] Enforcing strict docker-compose variable requirements..."
if ! grep -n -E "AXE_API_KEY=\\$\\{AXE_API_KEY:\\?" backend/docker-compose.yml >/dev/null; then
  echo "FAIL: backend/docker-compose.yml must require AXE_API_KEY."
  exit 1
fi
if ! grep -n -E "AXE_HMAC_SECRET=\\$\\{AXE_HMAC_SECRET:\\?" backend/docker-compose.yml >/dev/null; then
  echo "FAIL: backend/docker-compose.yml must require AXE_HMAC_SECRET."
  exit 1
fi

echo "[3/6] Verifying final audit script exists and executable..."
if [ ! -x "$ROOT_DIR/scripts/final-audit.sh" ]; then
  echo "FAIL: scripts/final-audit.sh must be executable."
  exit 1
fi

echo "[4/6] Native-only bridge hardening gate..."
"$ROOT_DIR/scripts/native-only-gate.sh"

echo "[5/6] Verifying local secret file permissions when present..."
if [ -f "$ROOT_DIR/.run/local-secrets.env" ]; then
  # macOS: stat -f '%OLp'; Linux (GitHub Actions): stat -c '%a'
  octal=""
  if octal="$(stat -f '%OLp' "$ROOT_DIR/.run/local-secrets.env" 2>/dev/null)"; then
    :
  else
    octal="$(stat -c '%a' "$ROOT_DIR/.run/local-secrets.env" 2>/dev/null || true)"
  fi
  case "$octal" in
    600|0600) : ;;
    *)
      echo "FAIL: .run/local-secrets.env must be mode 600 (got ${octal:-unknown})."
      exit 1
      ;;
  esac
fi

echo "[6/6] Enforcing admin-only exposure policy on API routes..."
PROXY_FILE="$ROOT_DIR/dashboard/proxy.ts"
if [ ! -f "$PROXY_FILE" ]; then
  echo "FAIL: dashboard/proxy.ts not found."
  exit 1
fi
if grep -nE '"/api/(admin|ops|quant/report|auth/wallet|market/amm/action|bridge/action)"' "$PROXY_FILE" >/dev/null 2>&1; then
  echo "FAIL: Sensitive API route leaked into proxy public allowlists."
  echo "Keep admin/ops/security-sensitive endpoints private (session + role protected)."
  exit 1
fi

echo "SECURITY GATES PASS"
