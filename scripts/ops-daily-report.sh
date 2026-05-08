#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
mkdir -p "${RUN_DIR}"
REPORT_FILE="${RUN_DIR}/ops-daily-report-$(date +%Y%m%d-%H%M%S).txt"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

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

http_status() {
  local url="$1"
  curl -sS --connect-timeout 4 --max-time 8 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
}

log "== BPVP Ops Daily Report =="
log "Repo: ${ROOT_DIR}"
log "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
log ""

log "== Tooling =="
for bin in curl node docker; do
  if command -v "$bin" >/dev/null 2>&1; then
    pass "Tool available: ${bin}"
  else
    warn "Tool missing: ${bin}"
  fi
done
log ""

log "== Local Service Endpoints =="
check_endpoint() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local status
  status="$(http_status "$url")"
  if [[ "$status" == "$expected" ]]; then
    pass "${name} ${url} -> ${status}"
  elif [[ "$status" == "000" ]]; then
    warn "${name} ${url} unreachable (service likely down)"
  else
    fail "${name} ${url} unexpected status ${status} (expected ${expected})"
  fi
}

check_endpoint "Engine health" "http://localhost:28080/health" "200"
check_endpoint "Indexer health" "http://localhost:28081/health" "200"
check_endpoint "Watcher health" "http://localhost:28082/health" "200"
check_endpoint "Dashboard login" "http://localhost:3100/login" "200"
log ""

log "== Release Consistency =="
wallet_version="$(node -e "const p=require('${ROOT_DIR}/bpvp-wallet/package.json');process.stdout.write(String(p.version||''));" 2>/dev/null || true)"
default_tag_version="$(node -e "const fs=require('fs');const s=fs.readFileSync('${ROOT_DIR}/dashboard/app/wallet/page.tsx','utf8');const m=s.match(/const DEFAULT_TAG\\s*=\\s*\"bpvp-wallet-v([0-9]+\\.[0-9]+\\.[0-9]+)\"/);process.stdout.write(m?m[1]:'');" 2>/dev/null || true)"

if [[ -n "${wallet_version}" ]]; then
  pass "Wallet package version: ${wallet_version}"
else
  fail "Could not read wallet package version"
fi

if [[ -n "${default_tag_version}" ]]; then
  pass "Dashboard default wallet tag: bpvp-wallet-v${default_tag_version}"
else
  fail "Could not read dashboard default wallet tag"
fi

if [[ -n "${wallet_version}" && -n "${default_tag_version}" ]]; then
  if [[ "${wallet_version}" == "${default_tag_version}" ]]; then
    pass "Wallet version matches dashboard default tag"
  else
    warn "Wallet version/tag mismatch (${wallet_version} vs ${default_tag_version})"
  fi
fi
log ""

log "== Latest Wallet Release Asset Verification =="
latest_tag="$(node -e "const fs=require('fs');const s=fs.readFileSync('${ROOT_DIR}/dashboard/app/wallet/page.tsx','utf8');const m=s.match(/const DEFAULT_TAG\\s*=\\s*\"(bpvp-wallet-v[0-9]+\\.[0-9]+\\.[0-9]+)\"/);process.stdout.write(m?m[1]:'');" 2>/dev/null || true)"
if [[ -z "${latest_tag}" ]]; then
  warn "Could not detect latest wallet tag from dashboard config"
else
  if "${ROOT_DIR}/scripts/release-verify-assets.sh" "${latest_tag}" >/dev/null 2>&1; then
    pass "Release assets verification passed for ${latest_tag}"
  else
    warn "Release assets verification not passing yet for ${latest_tag} (review release workflow)"
  fi
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
