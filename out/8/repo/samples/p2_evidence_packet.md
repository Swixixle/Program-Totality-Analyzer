# P2 Evidence Packet: Ed25519 Signature Verification + Receipt Chain Verification

## Date: 2026-02-03

## P2 Track A Scope
- Ed25519 signature verification with key registry
- Receipt chain verification (GENESIS/LINKED/BROKEN statuses)
- No LLM components, no schema v1.1 changes

---

## Signature Verification Tests

### Test 1: Valid Signature (Trusted Key)
**Input:** Valid Ed25519 signature from test-key-001 (trusted)
**Expected:** status: VALID
**Result:** PASS
```json
"signature":{"alg":"Ed25519","public_key_id":"test-key-001","status":"VALID","reason":"Signature verified with trusted key","issuer":"test-issuer","trusted":true}
```

### Test 2: Unknown Key
**Input:** Signature referencing unknown-key-xyz
**Expected:** status: UNTRUSTED_ISSUER
**Result:** PASS
```json
"signature":{"alg":"Ed25519","public_key_id":"unknown-key-xyz","status":"UNTRUSTED_ISSUER","reason":"Key unknown-key-xyz not found in registry"}
```

### Test 3: Invalid Signature
**Input:** Malformed signature with known key
**Expected:** status: INVALID
**Result:** PASS
```json
"signature":{"alg":"Ed25519","public_key_id":"test-key-001","status":"INVALID","reason":"Signature verification failed - signature does not match","issuer":"test-issuer","trusted":true}
```

---

## Chain Verification Tests

### Test 4: Genesis Receipt
**Input:** Receipt with no previous_receipt_hash_sha256
**Expected:** chain.status: GENESIS
**Result:** PASS
```json
"chain":{"checked":true,"status":"GENESIS","reason":"No previous_receipt_hash_sha256 - this is a genesis receipt"}
```

### Test 5: Chain Break (Previous Not Found)
**Input:** Receipt with previous_receipt_hash_sha256 that doesn't match any stored receipt
**Expected:** chain.status: BROKEN
**Result:** PASS
```json
"chain":{"checked":true,"status":"BROKEN","reason":"Previous receipt not found - chain cannot be verified","previous_hash_expected":"nonexistent-hash-abc123"}
```

### Test 6: Linked Receipt
**Input:** Receipt with previous_receipt_hash_sha256 matching stored genesis receipt
**Expected:** chain.status: LINKED
**Result:** PASS
```json
"chain":{"checked":true,"status":"LINKED","reason":"Chain verified - previous receipt hash matches","previous_receipt_id":"chain-proper-genesis","previous_hash_expected":"b500f5f8bc970bcb4763f37c58a6523d75fe0b8b38c14a548f8c3f4430990b49","previous_hash_computed":"b500f5f8bc970bcb4763f37c58a6523d75fe0b8b38c14a548f8c3f4430990b49"}
```

---

## Verification Status Logic

| Hash Match | Signature Status | Chain Status | Result |
|------------|------------------|--------------|--------|
| true       | VALID            | *            | VERIFIED |
| true       | UNTRUSTED_ISSUER | *            | PARTIALLY_VERIFIED |
| true       | NO_SIGNATURE     | *            | PARTIALLY_VERIFIED |
| false      | *                | *            | UNVERIFIED |
| *          | INVALID          | *            | UNVERIFIED |
| *          | *                | BROKEN       | UNVERIFIED |

---

## Chain Hash Formula
```
hash = SHA256(JSON.stringify({
  receipt_id,
  platform,
  captured_at,
  transcript_hash_sha256
}))
```

---

## Key Files Modified
- `server/key-registry.ts` - Ed25519 key registry and verification
- `server/chain-verification.ts` - Chain link verification logic
- `server/routes.ts` - Integration of signature and chain verification

## Signature Statuses
- VALID: Signature verified with trusted key
- INVALID: Signature verification failed
- UNTRUSTED_ISSUER: Key not found or issuer not trusted
- NO_SIGNATURE: No signature provided
- SKIPPED: Verification skipped (reserved)

## Chain Statuses
- GENESIS: No previous hash - first receipt in chain
- LINKED: Previous receipt found and hash matches
- BROKEN: Previous not found or hash mismatch
- NOT_CHECKED: Chain verification not requested
- UNKNOWN: Unable to verify (reserved)

---

## Acceptance: PASS
All P2 Track A requirements verified.
