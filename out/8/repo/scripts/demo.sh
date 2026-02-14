#!/usr/bin/env bash
set -euo pipefail

API_KEY="${API_KEY:-dev-test-key-12345}"
BASE="${BASE:-http://localhost:5000}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

section() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

step() {
  echo -e "${YELLOW}>>> $1${RESET}"
}

explain() {
  echo -e "${GREEN}    $1${RESET}"
}

run_curl() {
  echo -e "${BOLD}    \$ $1${RESET}"
  eval "$1" 2>/dev/null || echo -e "${RED}    [request failed]${RESET}"
  echo ""
}

pause() {
  echo -e "${CYAN}    [press Enter to continue]${RESET}"
  read -r
}

section "AI Receipts Forensic Verification - Operator Demo"
echo "  This system proves integrity of AI outputs without claiming semantic truth."
echo "  It provides tamper-evidence and operator-grade verification, not truth arbitration."
pause

section "1. Liveness Probe: GET /api/health"
step "No database dependency. Always returns 200 if the process is alive."
run_curl "curl -s $BASE/api/health | python3 -m json.tool"
explain "If you see status: ok, the system process is alive."
pause

section "2. Readiness Probe: GET /api/ready"
step "Checks DB connectivity + audit head integrity."
run_curl "curl -s $BASE/api/ready | python3 -m json.tool"
explain "status: ok = fully healthy. status: degraded = DB up but audit head inconsistent."
explain "Anti-flap design: returns 200 when DB is up, even if audit is degraded."
explain "HTTP 503 only when DB is unreachable."
pause

section "3. Audit Chain Verification: GET /api/audit/verify"
step "Full chain integrity check with operator-grade response."
run_curl "curl -s -H 'x-api-key: $API_KEY' '$BASE/api/audit/verify' | python3 -m json.tool"
explain "ok: true = no integrity violations. firstBadSeq: null = no corruption."
explain "partial: false = all events were checked (no cap hit)."
echo ""

step "Cursor-based segment verification (fromSeq=1, toSeq=5)."
run_curl "curl -s -H 'x-api-key: $API_KEY' '$BASE/api/audit/verify?fromSeq=1&toSeq=5' | python3 -m json.tool"
explain "partial: true is expected for cursor queries (segment only)."
pause

section "4. Error Discipline"
step "JSON 404 for unknown API routes (no HTML fallback)."
run_curl "curl -s $BASE/api/nonexistent | python3 -m json.tool"
explain "Every /api/* route returns structured JSON, even on 404."
echo ""

step "Rate limit headers on verify endpoint."
echo -e "${BOLD}    \$ curl -sI -H 'x-api-key: ...' .../api/audit/verify | grep -i ratelimit${RESET}"
curl -sI -H "x-api-key: $API_KEY" "$BASE/api/audit/verify" 2>/dev/null | grep -i "ratelimit" || echo "    [no rate limit headers]"
echo ""
explain "X-RateLimit-Limit/Remaining/Reset headers on every rate-limited response."
pause

section "5. Operator Telemetry: GET /api/health/metrics"
step "In-memory counters for operational visibility."
run_curl "curl -s -H 'x-api-key: $API_KEY' '$BASE/api/health/metrics' | python3 -m json.tool"
explain "Counters track: audit appends, verify results, policy violations, adapter errors."
explain "Counters reset on server restart (in-memory only)."
pause

section "6. Guarantees and Non-Goals"
echo ""
echo -e "  ${GREEN}What this system GUARANTEES:${RESET}"
echo "    1. Integrity    - SHA-256 hash chain detects modification/deletion/reordering"
echo "    2. Reproducibility - Deterministic canonicalization for identical hashing"
echo "    3. Verification contract - ok/broken/firstBadSeq pinpoints corruption"
echo "    4. Partial honesty - partial: true always reported when cap hit"
echo "    5. Boundary discipline - Wire/internal naming enforced in CI"
echo ""
echo -e "  ${RED}What this system does NOT guarantee:${RESET}"
echo "    1. Semantic truth - 'Verified' = cryptographically intact, not factually correct"
echo "    2. Completeness - 50,000 event cap per verify call"
echo "    3. AI correctness - LLM observations describe, never judge"
echo "    4. Full-privilege defense - DB admin rewrite requires external anchoring"
echo ""

section "Demo Complete"
echo "  For forensic export: npx tsx scripts/export_forensic_pack.ts"
echo "  For offline verification: npx tsx scripts/verify_forensic_pack.ts <pack.json>"
echo ""
