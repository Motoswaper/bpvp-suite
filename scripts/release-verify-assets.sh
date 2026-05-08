#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
REPO="${REPO:-Motoswaper/bpvp-suite}"
API_BASE="https://api.github.com/repos/${REPO}/releases/tags"

if [[ -z "${TAG}" ]]; then
  echo "Usage: ./scripts/release-verify-assets.sh <tag>"
  echo "Example: ./scripts/release-verify-assets.sh bpvp-wallet-v0.1.4"
  exit 1
fi

RUN_DIR=".run"
mkdir -p "${RUN_DIR}"
OUT_FILE="${RUN_DIR}/release-verify-${TAG}-$(date +%Y%m%d-%H%M%S).txt"

pass_count=0
warn_count=0
fail_count=0

log() {
  echo "$*" | tee -a "${OUT_FILE}"
}

pass() {
  pass_count=$((pass_count + 1))
  log "PASS: $*"
}

warn() {
  warn_count=$((warn_count + 1))
  log "WARN: $*"
}

fail() {
  fail_count=$((fail_count + 1))
  log "FAIL: $*"
}

json="$(curl -fsSL "${API_BASE}/${TAG}" 2>/dev/null || true)"
if [[ -z "${json}" ]]; then
  log "FAIL: Could not fetch release JSON for ${REPO}:${TAG}"
  log "Report: ${OUT_FILE}"
  exit 1
fi

node - <<'NODE' "${json}" "${OUT_FILE}"
const data = JSON.parse(process.argv[2]);
const outFile = process.argv[3];
const fs = require("fs");

const assets = Array.isArray(data.assets) ? data.assets : [];
const names = assets.map((a) => String(a.name || ""));
const sizeByName = Object.fromEntries(assets.map((a) => [String(a.name || ""), Number(a.size || 0)]));

let pass = 0;
let warn = 0;
let fail = 0;
const lines = [];

function log(line) {
  lines.push(line);
}
function p(msg) {
  pass += 1;
  log(`PASS: ${msg}`);
}
function w(msg) {
  warn += 1;
  log(`WARN: ${msg}`);
}
function f(msg) {
  fail += 1;
  log(`FAIL: ${msg}`);
}

const requiredAny = [
  { label: "Windows installer (.exe)", test: (n) => n.endsWith(".exe") },
  { label: "Linux AppImage", test: (n) => n.endsWith(".AppImage") },
  { label: "Linux deb package", test: (n) => n.endsWith(".deb") },
  { label: "macOS dmg", test: (n) => n.endsWith(".dmg") },
  { label: "Checksums manifest", test: (n) => n === "checksums.txt" }
];

const optionalSignals = [
  { label: "macOS zip", test: (n) => n.endsWith(".zip") && !n.startsWith("Source code") },
  { label: "Linux tar.gz", test: (n) => n.endsWith(".tar.gz") && !n.startsWith("Source code") }
];

if (assets.length === 0) {
  f("Release has no uploaded assets");
} else {
  p(`Release exposes ${assets.length} uploaded assets`);
}

for (const check of requiredAny) {
  const hit = names.find(check.test);
  if (hit) p(`${check.label} found: ${hit}`);
  else f(`${check.label} not found`);
}

for (const check of optionalSignals) {
  const hit = names.find(check.test);
  if (hit) p(`${check.label} found: ${hit}`);
  else w(`${check.label} not found`);
}

for (const name of names) {
  const size = sizeByName[name] || 0;
  if (size <= 0) f(`Asset has zero size: ${name}`);
}

const summary = [
  "== Release Asset Verification ==",
  `Tag: ${data.tag_name || "unknown"}`,
  `URL: ${data.html_url || "n/a"}`,
  "",
  ...lines,
  "",
  "== Summary ==",
  `PASS: ${pass}`,
  `WARN: ${warn}`,
  `FAIL: ${fail}`,
  `DECISION: ${fail > 0 ? "NO-GO" : warn > 0 ? "CONDITIONAL GO" : "GO"}`
];

fs.appendFileSync(outFile, summary.join("\n") + "\n", "utf8");
process.stdout.write(summary.join("\n") + "\n");
process.exit(fail > 0 ? 1 : 0);
NODE

echo "Report: ${OUT_FILE}"
