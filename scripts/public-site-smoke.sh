#!/usr/bin/env bash
# Read-only availability checks against the public dashboard (default: testnet).
# No credentials. Safe to run from CI or locally.
set -euo pipefail

BASE_URL="${PUBLIC_SITE_SMOKE_URL:-https://testnet.btc-defi.com}"
BASE_URL="${BASE_URL%/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_DIR="${REPO_ROOT}/.run"
mkdir -p "${RUN_DIR}"
REPORT_FILE="${RUN_DIR}/public-site-smoke-$(date +%Y%m%d-%H%M%S).txt"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

CURL_BASE=(
  curl -sS -L --connect-timeout 12 --max-time 45
  -H "user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

log() {
  echo "$*" | tee -a "${REPORT_FILE}"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  log "PASS: $*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  log "WARN: $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  log "FAIL: $*"
}

# Args: url, use_fail_flag(1 = fail on HTTP 4xx/5xx for success-path probes)
http_code() {
  local url="$1"
  local use_f="${2:-0}"
  local code curl_ec
  set +e
  if [[ "${use_f}" == "1" ]]; then
    code="$("${CURL_BASE[@]}" -f -o /dev/null -w "%{http_code}" "${url}" 2>/dev/null)"
    curl_ec=$?
  else
    code="$("${CURL_BASE[@]}" -o /dev/null -w "%{http_code}" "${url}" 2>/dev/null)"
    curl_ec=$?
  fi
  set -e
  # Curl may exit non-zero (-f) after printing the status line; still trust http_code when present.
  if [[ -z "${code}" ]]; then
    echo "000"
    return 0
  fi
  echo "${code}"
}

log "== Public Site Smoke =="
log "Target: ${BASE_URL}"
log "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
log ""

home_code="$(http_code "${BASE_URL}/" 1)"
log "Signal: GET / -> ${home_code}"
if [[ "${home_code}" == "200" ]]; then
  pass "GET / -> 200"
else
  if [[ "${home_code}" == "000" ]]; then
    fail "GET / unreachable or TLS error"
  else
    fail "GET / expected 200, got ${home_code}"
  fi
fi

session_code="$(http_code "${BASE_URL}/api/auth/session" 0)"
log "Signal: GET /api/auth/session -> ${session_code}"
if [[ "${session_code}" == "401" || "${session_code}" == "403" ]]; then
  pass "GET /api/auth/session -> ${session_code} (unauthenticated/edge-protected)"
elif [[ "${session_code}" == "000" ]]; then
  fail "GET /api/auth/session unreachable"
else
  fail "GET /api/auth/session expected 401/403, got ${session_code}"
fi

sitemap_code="$(http_code "${BASE_URL}/sitemap.xml" 1)"
log "Signal: GET /sitemap.xml -> ${sitemap_code}"
if [[ "${sitemap_code}" == "200" ]]; then
  pass "GET /sitemap.xml -> 200"
elif [[ "${sitemap_code}" == "000" ]]; then
  warn "GET /sitemap.xml unreachable (site may be down)"
else
  warn "GET /sitemap.xml expected 200, got ${sitemap_code}"
fi

robots_code="$(http_code "${BASE_URL}/robots.txt" 1)"
log "Signal: GET /robots.txt -> ${robots_code}"
if [[ "${robots_code}" == "200" ]]; then
  pass "GET /robots.txt -> 200"
elif [[ "${robots_code}" == "000" ]]; then
  warn "GET /robots.txt unreachable"
else
  warn "GET /robots.txt expected 200, got ${robots_code}"
fi

log ""
log "== Summary =="
log "PASS: ${PASS_COUNT}"
log "WARN: ${WARN_COUNT}"
log "FAIL: ${FAIL_COUNT}"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  log "DECISION: NO-GO"
  log "Report: ${REPORT_FILE}"
  exit 1
fi

if [[ "${WARN_COUNT}" -gt 0 ]]; then
  log "DECISION: CONDITIONAL GO"
else
  log "DECISION: GO"
fi
log "Report: ${REPORT_FILE}"
