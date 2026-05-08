#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
mkdir -p "${RUN_DIR}"
REPORT_FILE="${RUN_DIR}/release-readiness-$(date +%Y%m%d-%H%M%S).txt"

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

check_file() {
  local rel="$1"
  if [[ -f "${ROOT_DIR}/${rel}" ]]; then
    pass "Found ${rel}"
  else
    fail "Missing ${rel}"
  fi
}

file_contains() {
  local rel="$1"
  local pattern="$2"
  ROOT_FOR_NODE="${ROOT_DIR}" REL_FOR_NODE="${rel}" PATTERN_FOR_NODE="${pattern}" \
    node -e "const fs=require('fs');const p=process.env.ROOT_FOR_NODE+'/'+process.env.REL_FOR_NODE;const s=fs.readFileSync(p,'utf8');process.exit(new RegExp(process.env.PATTERN_FOR_NODE,'m').test(s)?0:1);" >/dev/null 2>&1
}

log "== Release Readiness =="
log "Repo: ${ROOT_DIR}"
log "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
log ""

log "== Required Files =="
check_file ".github/workflows/ci.yml"
check_file ".github/workflows/roles-access-smoke.yml"
check_file ".github/workflows/bpvp-wallet-release.yml"
check_file "docs/CI_GATES.md"
check_file "docs/BPVP_WALLET_RELEASE_PROCESS.md"
check_file "scripts/roles-access-smoke.sh"
check_file "scripts/release-readiness.sh"
log ""

log "== Workflow Hygiene =="
if node -e "const fs=require('fs');const path=require('path');const d='${ROOT_DIR}/.github/workflows';let bad=false;for(const f of fs.readdirSync(d)){if(!f.endsWith('.yml')) continue;const s=fs.readFileSync(path.join(d,f),'utf8');if(/actions\/(checkout|setup-node|upload-artifact)@v4/.test(s)){bad=true;break;}}process.exit(bad?0:1);" >/dev/null 2>&1; then
  fail "Deprecated JS action versions (@v4) still present in workflows"
else
  pass "Workflows use modern checkout/setup-node/upload-artifact versions"
fi

if node -e "const fs=require('fs');const path=require('path');const d='${ROOT_DIR}/.github/workflows';let bad=false;for(const f of fs.readdirSync(d)){if(!f.endsWith('.yml')) continue;const s=fs.readFileSync(path.join(d,f),'utf8');if(/node-version:\s*\"20\"/.test(s)){bad=true;break;}}process.exit(bad?0:1);" >/dev/null 2>&1; then
  warn "Some workflow still pins node-version 20"
else
  pass "No workflow is pinned to node-version 20"
fi

if file_contains ".github/workflows/ci.yml" "name:\\s*REQUIRED - AXE CI"; then
  pass "AXE CI workflow labeled as REQUIRED"
else
  warn "AXE CI workflow name not labeled as REQUIRED"
fi
log ""

log "== Roles Smoke Wiring =="
if file_contains ".github/workflows/roles-access-smoke.yml" "127\\.0\\.0\\.1:3100"; then
  pass "Roles smoke uses local runner base URL"
else
  fail "Roles smoke workflow does not use local runner base URL"
fi

if file_contains "scripts/roles-access-smoke.sh" "/api/engine/action/authorize"; then
  pass "Roles smoke script validates via authorize endpoint"
else
  fail "Roles smoke script is not using authorize endpoint"
fi
log ""

log "== Wallet Release Consistency =="
wallet_version="$(node -e "const p=require('${ROOT_DIR}/bpvp-wallet/package.json'); process.stdout.write(String(p.version||''));")"
default_tag="$(node -e "const fs=require('fs');const s=fs.readFileSync('${ROOT_DIR}/dashboard/app/wallet/page.tsx','utf8');const m=s.match(/const DEFAULT_TAG\\s*=\\s*\"bpvp-wallet-v([0-9]+\\.[0-9]+\\.[0-9]+)\"/);process.stdout.write(m?m[1]:'');")"

if [[ -n "${wallet_version}" ]]; then
  pass "Wallet package version detected: ${wallet_version}"
else
  fail "Wallet package version missing"
fi

if [[ -n "${default_tag}" ]]; then
  pass "Dashboard wallet default tag detected: bpvp-wallet-v${default_tag}"
else
  fail "Dashboard wallet default tag not found"
fi

if [[ -n "${wallet_version}" && -n "${default_tag}" ]]; then
  if [[ "${wallet_version}" == "${default_tag}" ]]; then
    pass "Wallet package version matches dashboard default tag"
  else
    warn "Version mismatch: bpvp-wallet/package.json=${wallet_version}, dashboard default tag=${default_tag}"
  fi
fi
log ""

log "== Summary =="
log "PASS: ${PASS_COUNT}"
log "WARN: ${WARN_COUNT}"
log "FAIL: ${FAIL_COUNT}"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  log "DECISION: NO-GO (fix FAIL items first)"
  log "Report: ${REPORT_FILE}"
  exit 1
fi

if [[ "${WARN_COUNT}" -gt 0 ]]; then
  log "DECISION: CONDITIONAL GO (review WARN items)"
else
  log "DECISION: GO"
fi
log "Report: ${REPORT_FILE}"
