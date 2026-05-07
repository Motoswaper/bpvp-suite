#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3100}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
OPERATOR_USER="${OPERATOR_USER:-operator-smoke}"
OPERATOR_PASSWORD="${OPERATOR_PASSWORD:-op-$(date +%s)-$(openssl rand -hex 3)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

WORK_DIR="$(mktemp -d)"
ADMIN_COOKIES="${WORK_DIR}/admin.cookies"
OP_COOKIES="${WORK_DIR}/operator.cookies"
VIEWER_COOKIES="${WORK_DIR}/viewer.cookies"
REPORT_DIR="${REPO_ROOT}/.run"
mkdir -p "${REPORT_DIR}"
REPORT_FILE="${REPORT_DIR}/roles-smoke-$(date +%Y%m%d-%H%M%S).txt"

if [[ -z "${ADMIN_PASSWORD}" ]]; then
  echo "FAIL: ADMIN_PASSWORD is required." | tee -a "${REPORT_FILE}"
  echo "Usage: ADMIN_PASSWORD='<admin password>' BASE_URL='http://127.0.0.1:3100' ./scripts/roles-access-smoke.sh" | tee -a "${REPORT_FILE}"
  echo "Report: ${REPORT_FILE}" | tee -a "${REPORT_FILE}"
  exit 1
fi

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

pass() {
  echo "PASS: $*" | tee -a "${REPORT_FILE}"
}

fail() {
  echo "FAIL: $*" | tee -a "${REPORT_FILE}"
  exit 1
}

section() {
  echo "" | tee -a "${REPORT_FILE}"
  echo "== $* ==" | tee -a "${REPORT_FILE}"
}

http_status() {
  local method="$1"
  local path="$2"
  local cookies_in="${3:-}"
  local cookies_out="${4:-}"
  local body="${5:-}"
  local url="${BASE_URL}${path}"
  local args=(-sS -o /dev/null -w "%{http_code}" -X "${method}" "${url}" -H "Origin: ${BASE_URL}" -H "Referer: ${BASE_URL}/")
  if [[ -n "${cookies_in}" ]]; then
    args+=(-b "${cookies_in}")
  fi
  if [[ -n "${cookies_out}" ]]; then
    args+=(-c "${cookies_out}")
  fi
  if [[ -n "${body}" ]]; then
    args+=(-H "content-type: application/json" --data "${body}")
  fi
  curl "${args[@]}"
}

section "Health check"
status="$(http_status GET "/" "" "")"
[[ "${status}" == "200" ]] && pass "Base URL reachable (${BASE_URL})" || fail "Base URL not reachable: ${status}"

section "Admin login"
status="$(http_status POST "/api/auth/login" "" "${ADMIN_COOKIES}" "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASSWORD}\"}")"
[[ "${status}" == "200" ]] && pass "Admin login OK" || fail "Admin login failed (${status})"

status="$(http_status GET "/api/auth/session" "${ADMIN_COOKIES}" "")"
[[ "${status}" == "200" ]] && pass "Admin session active" || fail "Admin session check failed (${status})"

section "Create/refresh operator user"
status="$(http_status POST "/api/admin/users" "${ADMIN_COOKIES}" "" "{\"action\":\"upsert\",\"username\":\"${OPERATOR_USER}\",\"role\":\"operator\",\"password\":\"${OPERATOR_PASSWORD}\",\"enabled\":true}")"
[[ "${status}" == "200" ]] && pass "Operator user upserted (${OPERATOR_USER})" || fail "Operator upsert failed (${status})"

section "Operator login and access check"
status="$(http_status POST "/api/auth/login" "" "${OP_COOKIES}" "{\"username\":\"${OPERATOR_USER}\",\"password\":\"${OPERATOR_PASSWORD}\"}")"
[[ "${status}" == "200" ]] && pass "Operator login OK" || fail "Operator login failed (${status})"

status="$(http_status POST "/api/engine/action" "${OP_COOKIES}" "" "{\"module\":\"otc\",\"type\":\"rfq_create\",\"data\":{}}")"
if [[ "${status}" == "401" || "${status}" == "403" ]]; then
  fail "Operator denied engine action (${status})"
else
  pass "Operator not denied on engine action (${status})"
fi

section "Viewer registration and access check"
status="$(http_status POST "/api/auth/register" "" "${VIEWER_COOKIES}" "{}")"
[[ "${status}" == "200" ]] && pass "Viewer registration/login flow OK" || fail "Viewer registration failed (${status})"

status="$(http_status POST "/api/engine/action" "${VIEWER_COOKIES}" "" "{\"module\":\"otc\",\"type\":\"rfq_create\",\"data\":{}}")"
if [[ "${status}" == "401" || "${status}" == "403" ]]; then
  pass "Viewer correctly blocked from engine action (${status})"
else
  fail "Viewer should be blocked, got (${status})"
fi

section "Operator denied admin endpoint"
status="$(http_status GET "/api/admin/users" "${OP_COOKIES}" "")"
if [[ "${status}" == "401" || "${status}" == "403" ]]; then
  pass "Operator blocked from admin users endpoint (${status})"
else
  fail "Operator unexpectedly accessed admin endpoint (${status})"
fi

echo "" | tee -a "${REPORT_FILE}"
echo "Completed successfully." | tee -a "${REPORT_FILE}"
echo "Report: ${REPORT_FILE}" | tee -a "${REPORT_FILE}"
