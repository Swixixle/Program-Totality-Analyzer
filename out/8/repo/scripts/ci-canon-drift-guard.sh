#!/usr/bin/env bash
set -euo pipefail

echo "=== Canonicalization Drift Guard ==="
echo "Checking that stableStringifyStrict/auditPayloadV1/hashAuditPayload only appear in allowed files..."

CANON_ALLOWED="server/audit-canon.ts|server/storage.ts|server/__tests__|scripts/export_forensic_pack.ts|scripts/verify_forensic_pack.ts"

VIOLATIONS=$(grep -rn 'function stableStringifyStrict\|function auditPayloadV1\|function hashAuditPayload' server/ scripts/ --include='*.ts' --include='*.tsx' | grep -vE "$CANON_ALLOWED" || true)

if [ -n "$VIOLATIONS" ]; then
  echo "::error::Canonicalization drift detected! Hash/canon logic found outside audit-canon.ts:"
  echo "$VIOLATIONS"
  exit 1
fi

IMPL_COUNT=$(grep -c 'export function stableStringifyStrict' server/audit-canon.ts || true)
if [ "$IMPL_COUNT" -ne 1 ]; then
  echo "::error::Expected exactly 1 export of stableStringifyStrict in server/audit-canon.ts, found $IMPL_COUNT"
  exit 1
fi

echo "Canonicalization drift guard passed: single source of truth in server/audit-canon.ts"
