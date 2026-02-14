#!/usr/bin/env bash
set -euo pipefail

echo "=== Forensic Export/Verify CI Gate ==="

PACK_FILE="/tmp/ci_forensic_pack.json"

echo "Step 1: Seeding audit events via API..."
API_KEY="${API_KEY:-dev-test-key-12345}"
BASE="${BASE:-http://localhost:5000}"

for i in 1 2 3; do
  RESPONSE=$(curl -sf -X POST "$BASE/api/receipts/verify" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d '{
      "schema": "ai-receipt/1.0",
      "request_id": "ci-seed-'"$i"'",
      "receipt_capsule": {
        "schema": "ai-receipt/1.0",
        "receipt_id": "ci-seed-receipt-'"$i"'-'"$(date +%s)"'",
        "platform": "ci-test",
        "captured_at": "2026-01-01T00:00:00Z",
        "capture_agent": "ci-gate",
        "transcript": {
          "embedded": true,
          "canonicalization": "c14n-v1",
          "messages": [{"role": "user", "content": "test '"$i"'"}]
        },
        "transcript_hash_sha256": "placeholder"
      }
    }' 2>/dev/null || echo "SEED_FAIL")
  if [ "$RESPONSE" = "SEED_FAIL" ]; then
    echo "  Warning: Seed request $i returned error (may already have events)"
  else
    echo "  Seeded event $i"
  fi
done

echo ""
echo "Step 2: Exporting forensic pack..."
npx tsx scripts/export_forensic_pack.ts --output "$PACK_FILE"

if [ ! -f "$PACK_FILE" ]; then
  echo "::error::Forensic pack export failed: $PACK_FILE not created"
  exit 1
fi
echo "  Pack exported: $PACK_FILE"

echo ""
echo "Step 3: Verifying pack offline..."
npx tsx scripts/verify_forensic_pack.ts "$PACK_FILE"
VERIFY_EXIT=$?

if [ $VERIFY_EXIT -ne 0 ]; then
  echo "::error::Forensic pack offline verification failed"
  exit 1
fi

echo ""
echo "Step 4: Tamper detection test..."
TAMPERED_FILE="/tmp/ci_forensic_pack_tampered.json"
cp "$PACK_FILE" "$TAMPERED_FILE"

python3 -c "
import json
with open('$TAMPERED_FILE') as f:
    pack = json.load(f)
if pack['events']:
    pack['events'][0]['action'] = 'TAMPERED_ACTION'
with open('$TAMPERED_FILE', 'w') as f:
    json.dump(pack, f)
"

set +e
npx tsx scripts/verify_forensic_pack.ts "$TAMPERED_FILE" 2>&1
TAMPER_EXIT=$?
set -e

if [ $TAMPER_EXIT -eq 0 ]; then
  echo "::error::Tamper detection FAILED: modified pack passed verification"
  exit 1
fi
echo "  Tamper correctly detected (exit code $TAMPER_EXIT)"

echo ""
echo "Step 5: Collecting proof bundle..."
PROOF_DIR="/tmp/ci-proof-bundle"
mkdir -p "$PROOF_DIR"
cp "$PACK_FILE" "$PROOF_DIR/forensic_pack.json"
npx tsx scripts/verify_forensic_pack.ts "$PACK_FILE" > "$PROOF_DIR/verify_output.txt" 2>&1 || true
curl -sf -H "x-api-key: $API_KEY" "$BASE/api/audit/verify" > "$PROOF_DIR/live_verify.json" 2>/dev/null || echo '{"error":"unavailable"}' > "$PROOF_DIR/live_verify.json"
curl -sf "$BASE/api/health" > "$PROOF_DIR/health.json" 2>/dev/null || echo '{"error":"unavailable"}' > "$PROOF_DIR/health.json"

echo "  Proof bundle written to: $PROOF_DIR/"
ls -la "$PROOF_DIR/"

echo ""
echo "=== Forensic gate PASSED ==="

rm -f "$TAMPERED_FILE"
