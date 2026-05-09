#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-Motoswaper/bpvp-suite}"
BRANCH="${AUDIT_REPORT_BRANCH:-main}"
WORKFLOW_LIMIT="${AUDIT_REPORT_WORKFLOW_LIMIT:-50}"
API_URL="https://api.github.com/repos/${REPO}/actions/runs?branch=${BRANCH}&per_page=${WORKFLOW_LIMIT}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
mkdir -p "${RUN_DIR}"
REPORT_FILE="${RUN_DIR}/audit-weekly-report-$(date +%Y%m%d-%H%M%S).txt"

log() {
  echo "$*" | tee -a "${REPORT_FILE}"
}

log "== BPVP Weekly Audit Report =="
log "Repo: ${REPO}"
log "Branch: ${BRANCH}"
log "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
log ""

set +e
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  json="$(curl -sS --connect-timeout 12 --max-time 45 \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" "${API_URL}")"
  curl_ec=$?
else
  json="$(curl -sS --connect-timeout 12 --max-time 45 \
    -H "Accept: application/vnd.github+json" "${API_URL}")"
  curl_ec=$?
fi
set -e

if [[ "${curl_ec}" -ne 0 || -z "${json}" ]]; then
  log "FAIL: Could not fetch workflow runs from GitHub API."
  log "Report: ${REPORT_FILE}"
  exit 1
fi

SUMMARY="$(
JSON_INPUT="${json}" node - <<'NODE'
const data = JSON.parse(process.env.JSON_INPUT || "{}");
const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];

const required = [];
const info = [];
for (const run of runs) {
  const name = String(run.name || "");
  const conclusion = String(run.conclusion || run.status || "unknown");
  const item = { name, conclusion, html_url: String(run.html_url || "") };
  if (name.startsWith("REQUIRED - ")) required.push(item);
  if (name.startsWith("INFO - ")) info.push(item);
}

function latestByName(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.name)) map.set(it.name, it);
  }
  return [...map.values()];
}

const reqLatest = latestByName(required);
const infoLatest = latestByName(info);

let reqPass = 0;
let reqFail = 0;
for (const it of reqLatest) {
  if (it.conclusion === "success") reqPass += 1;
  else reqFail += 1;
}

let infoPass = 0;
let infoFail = 0;
for (const it of infoLatest) {
  if (it.conclusion === "success") infoPass += 1;
  else infoFail += 1;
}

console.log(`REQ_TOTAL=${reqLatest.length}`);
console.log(`REQ_PASS=${reqPass}`);
console.log(`REQ_FAIL=${reqFail}`);
console.log(`INFO_TOTAL=${infoLatest.length}`);
console.log(`INFO_PASS=${infoPass}`);
console.log(`INFO_FAIL=${infoFail}`);
console.log("REQ_LINES_START");
for (const it of reqLatest) console.log(`${it.name} -> ${it.conclusion} :: ${it.html_url}`);
console.log("REQ_LINES_END");
console.log("INFO_LINES_START");
for (const it of infoLatest) console.log(`${it.name} -> ${it.conclusion} :: ${it.html_url}`);
console.log("INFO_LINES_END");
NODE
)"

REQ_TOTAL="$(printf "%s\n" "${SUMMARY}" | awk -F= '/^REQ_TOTAL=/{print $2}')"
REQ_PASS="$(printf "%s\n" "${SUMMARY}" | awk -F= '/^REQ_PASS=/{print $2}')"
REQ_FAIL="$(printf "%s\n" "${SUMMARY}" | awk -F= '/^REQ_FAIL=/{print $2}')"
INFO_TOTAL="$(printf "%s\n" "${SUMMARY}" | awk -F= '/^INFO_TOTAL=/{print $2}')"
INFO_PASS="$(printf "%s\n" "${SUMMARY}" | awk -F= '/^INFO_PASS=/{print $2}')"
INFO_FAIL="$(printf "%s\n" "${SUMMARY}" | awk -F= '/^INFO_FAIL=/{print $2}')"

log "== REQUIRED (latest per workflow) =="
printf "%s\n" "${SUMMARY}" | awk '/^REQ_LINES_START$/{f=1;next}/^REQ_LINES_END$/{f=0}f' | tee -a "${REPORT_FILE}"
log ""

log "== INFO (latest per workflow) =="
printf "%s\n" "${SUMMARY}" | awk '/^INFO_LINES_START$/{f=1;next}/^INFO_LINES_END$/{f=0}f' | tee -a "${REPORT_FILE}"
log ""

log "== Summary =="
log "REQUIRED: total=${REQ_TOTAL:-0} pass=${REQ_PASS:-0} fail=${REQ_FAIL:-0}"
log "INFO: total=${INFO_TOTAL:-0} pass=${INFO_PASS:-0} fail=${INFO_FAIL:-0}"

if [[ "${REQ_FAIL:-0}" -gt 0 ]]; then
  log "DECISION: NO-GO (required workflows failing)"
  log "Report: ${REPORT_FILE}"
  exit 1
fi

if [[ "${INFO_FAIL:-0}" -gt 0 ]]; then
  log "DECISION: CONDITIONAL GO (required green, review info failures)"
else
  log "DECISION: GO"
fi
log "Report: ${REPORT_FILE}"
