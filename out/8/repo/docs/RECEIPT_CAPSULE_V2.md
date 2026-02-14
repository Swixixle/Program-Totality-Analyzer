# Receipt Capsule v2 Schema Design

> **Status:** Proposed (Not Implemented)  
> **Phase:** Future consideration  
> **Purpose:** Proves integrity/authenticity without revealing raw transcript

---

## Overview

This document describes an enhanced receipt capsule design that:
- Proves sequence integrity without exposing text
- Uses per-line commitment chains for tamper-evidence
- Embeds policy constraints into signed payload
- Supports cryptographic redaction commitments

---

## 1. Top-level Schema

```json
{
  "schema": "ai-receipt/1.0",
  "receipt_id": "rct_...",
  "created_at": "2026-02-03T07:05:08Z",
  "issuer": { ... },
  "algorithms": { ... },
  "subject": { ... },
  "policy": { ... },
  "transcript_commitment": { ... },
  "event_log_commitment": { ... },
  "signature": { ... }
}
```

### Field Definitions

| Field | Description |
|-------|-------------|
| `schema` | Fixed: `"ai-receipt/1.0"` |
| `receipt_id` | Public lookup key (e.g., `rct_<base32(sha256(final_hash))[:26]>`) |
| `created_at` | RFC3339/ISO8601 UTC timestamp |
| `issuer` | Attestation authority and key reference |
| `algorithms` | Hash, signature, and canonicalization methods |
| `subject` | Optional metadata (no user identifiers) |
| `policy` | Limits contract baked into receipt |
| `transcript_commitment` | Per-line commitment chain |
| `event_log_commitment` | Governance event trail |
| `signature` | Ed25519 signature over canonical payload |

---

## 2. Issuer Block

```json
{
  "name": "AI Receipts",
  "issuer_id": "issr_public",
  "key_id": "ed25519:pub:K1",
  "key_status": "ACTIVE"
}
```

---

## 3. Algorithms Block

```json
{
  "hash": "SHA-256",
  "signature": "Ed25519",
  "canonicalization": "c14n-v1"
}
```

---

## 4. Policy Block

Explicit non-capability claims signed into receipt:

```json
{
  "llm_mode": "SENSOR_ONLY",
  "no_truth_claims": true,
  "no_transcript_storage": true,
  "no_export_raw_transcript": true,
  "forbidden_claims": [
    "truth_scoring",
    "semantic_arbitration",
    "behavioral_interpretation"
  ],
  "redaction": {
    "enabled": true,
    "method": "commitment_only"
  }
}
```

---

## 5. Transcript Commitment (LINE_CHAIN_V1)

Per-line commitment chain proving sequence integrity without content:

```json
{
  "type": "LINE_CHAIN_V1",
  "line_count": 31,
  "genesis_hash": "0000...0000",
  "final_hash": "a3c89e...86288d9a",
  "links": [
    {
      "i": 0,
      "prev": "GENESIS",
      "line_commit": "hex...",
      "redacted": true,
      "redaction_reason": "privacy"
    },
    {
      "i": 1,
      "prev": "hex...",
      "line_commit": "hex..."
    }
  ]
}
```

### Line Commitment Computation

**Canonical line payload** (at minting time, not stored):

```json
{
  "i": 12,
  "role": "assistant",
  "ts": "2026-02-03T07:05:01Z",
  "content": "<raw text or [REDACTED]>",
  "attachments": [],
  "meta": { "model": "masked", "channel": "chat" }
}
```

**Chain link computation:**

```
line_hash = sha256(c14n(line_payload))
link_hash = sha256(prev_hash || line_hash || uint32_be(i))
```

Only `line_commit = link_hash` is stored publicly.

### Properties

- Order integrity
- Deletion/insertion detection
- Reproducible verification if content later disclosed

---

## 6. Redaction Modes

### Mode A: Commitment Only (Simplest)

Receipt publishes only chain hashes. Content withheld entirely.

### Mode B: Per-line Markers

```json
{
  "i": 12,
  "prev": "...",
  "line_commit": "...",
  "redacted": true,
  "redaction_reason": "privacy"
}
```

No content, no lengths, no tokens. Just "withheld."

---

## 7. Event Log Commitment

```json
{
  "type": "EVENT_LOG_CHAIN_V1",
  "event_count": 9,
  "final_hash": "hex...",
  "public_events": [
    { "type": "VERIFY_RUN", "ts": "2026-02-03T07:05:08Z" },
    { "type": "KEY_STATUS", "ts": "2026-02-03T07:05:08Z", "status": "ACTIVE" }
  ]
}
```

Minimal governance trail. No infrastructure leaks.

---

## 8. Signature Block

### Signing Input

Sign canonical bytes of:

```json
{
  "schema": "...",
  "receipt_id": "...",
  "created_at": "...",
  "issuer": { ... },
  "algorithms": { ... },
  "policy": { ... },
  "transcript_commitment": { ... },
  "event_log_commitment": { ... }
}
```

Exclude signature field. Canonicalize with c14n-v1. Sign with Ed25519.

### Signature Object

```json
{
  "key_id": "ed25519:pub:K1",
  "signed_hash": "sha256(canonical_bytes)",
  "sig": "base64...",
  "status": "VALID"
}
```

---

## 9. Comparison: Current vs Proposed

| Feature | Current (v1) | Proposed (v2) |
|---------|--------------|---------------|
| Transcript | Embedded (optional redaction) | Commitment-only chain |
| Chain integrity | Receipt-to-receipt | Line-by-line within receipt |
| Policy | Implicit via docs | Explicit in signed payload |
| Redaction | Display mode toggle | Cryptographic commitments |
| Event log | Separate forensic log | Committed into receipt |
| Verification | Hash + signature | Chain walk + hash + signature |

---

## 10. Verification Bundle

A complete proof bundle for independent verification:

- `receipt.json` - The receipt capsule
- `issuer_pubkey.json` - Public key for signature verification
- `verify_output.json` - Verification results
- `INDEPENDENT_VERIFY.md` - Run instructions

Anyone can verify:
- Chain is linked
- Signature validates
- Policy claims are bound into signed content

**No transcript needed.**

---

## Implementation Notes

When implementing, create:
1. `shared/capsule-v2-schema.ts` - Zod schemas
2. `server/commitment-chain.ts` - LINE_CHAIN_V1 builder
3. `server/capsule-v2-verify.ts` - Verification logic
4. `script/mint_capsule_v2.ts` - Minting tool
5. Tests for chain computation and verification
