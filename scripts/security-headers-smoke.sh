#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SECURITY_HEADERS_SMOKE_URL:-https://testnet.btc-defi.com}"
BASE_URL="${BASE_URL%/}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
mkdir -p "${RUN_DIR}"
REPORT_FILE="${RUN_DIR}/security-headers-smoke-$(date +%Y%m%d-%H%M%S).txt"

PASS_COUNT=0
FAIL_COUNT=0

log() {
  echo "$*" | tee -a "${REPORT_FILE}"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  log "PASS: $*"
}

warn() {
  log "WARN: $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  log "FAIL: $*"
}

require_header() {
  local headers="$1"
  local name="$2"
  local severity="${3:-fail}"
  if printf "%s\n" "$headers" | awk -v n="$(printf "%s" "$name" | tr '[:upper:]' '[:lower:]')" '
    BEGIN { found=0 }
    {
      line=tolower($0)
      if (index(line, n ":") == 1) found=1
    }
    END { exit(found ? 0 : 1) }
  '; then
    pass "Header present: ${name}"
  else
    if [[ "${severity}" == "warn" ]]; then
      warn "Missing header: ${name}"
    else
      fail "Missing header: ${name}"
    fi
  fi
}

log "== Security Headers Smoke =="
log "Target: ${BASE_URL}"
log "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
log ""

headers="$(curl -sS -I --connect-timeout 12 --max-time 45 "${BASE_URL}/" 2>/dev/null || true)"
if [[ -z "${headers}" ]]; then
  fail "Could not fetch response headers from ${BASE_URL}/"
else
  require_header "${headers}" "content-security-policy" "fail"
  require_header "${headers}" "x-frame-options" "fail"
  require_header "${headers}" "x-content-type-options" "fail"
  require_header "${headers}" "referrer-policy" "fail"
  require_header "${headers}" "permissions-policy" "fail"
  require_header "${headers}" "cross-origin-opener-policy" "fail"
  require_header "${headers}" "cross-origin-resource-policy" "fail"
  require_header "${headers}" "x-permitted-cross-domain-policies" "warn"
  require_header "${headers}" "origin-agent-cluster" "warn"

  csp_line="$(printf "%s\n" "${headers}" | awk '
    BEGIN { IGNORECASE=1 }
    /^content-security-policy:/ { print; exit }
  ')"
  if printf "%s" "${csp_line}" | tr '[:upper:]' '[:lower:]' | awk '/unsafe-eval/ { exit 0 } END { exit 1 }'; then
    fail "CSP contains unsafe-eval in production endpoint"
  else
    pass "CSP excludes unsafe-eval"
  fi
fi

log ""
log "== Summary =="
log "PASS: ${PASS_COUNT}"
log "FAIL: ${FAIL_COUNT}"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  log "DECISION: NO-GO"
  log "Report: ${REPORT_FILE}"
  exit 1
fi

log "DECISION: GO"
log "Report: ${REPORT_FILE}"
