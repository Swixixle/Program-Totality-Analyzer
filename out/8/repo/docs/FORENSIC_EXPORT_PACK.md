# Forensic Export Pack

A portable evidence bundle that lets an external reviewer verify audit chain integrity without access to the running system.

---

## Quick Start

### Export a pack

```bash
# Export all audit events
npx tsx scripts/export_forensic_pack.ts --output my_pack.json

# Export a specific segment
npx tsx scripts/export_forensic_pack.ts --from 1 --to 100 --output segment_pack.json
```

### Verify a pack offline

```bash
# No database needed — pure cryptographic replay
npx tsx scripts/verify_forensic_pack.ts my_pack.json

# With Ed25519 checkpoint signature verification
npx tsx scripts/verify_forensic_pack.ts my_pack.json --public-key checkpoint_public.pem
```

Expected output (healthy):
```
Forensic Pack Offline Verifier
==============================
Format:      ai-receipts-forensic-pack/1.2
Exported at: 2026-02-12T07:24:28.920Z
Segment:     seq 1-23 (23 events)
DB total:    23 events at export time
Algorithm:   SHA-256

Pack integrity: OK (pack hash matches)

RESULT: PASS (hash chain)
  Chain status: LINKED
  Checked:      23/23 events
  Segment:      seq 1-23
  Head:         seq=23 hash=6584417cf0e22870...
  Coverage:     FULL
  Head match:   OK (matches head at export time)

Checkpoints:    2 found in pack
  Chain:        2 checkpoints linked
  Anchors:      2 checkpoint-event hashes match
  Signatures:   2/2 Ed25519 signatures VERIFIED

Anchors:        2 anchor receipts in pack
  Types:        log-only
  Verified:     2/2 anchor hashes match
  Log-only:     2 anchors (structured log only, no external trust boundary)
```

Expected output (tampered):
```
FAIL: Pack integrity check failed.
  Expected pack hash: 6494ebc4...
  Computed pack hash: 21f3dfcf...
  The pack file itself has been modified after export.
```

---

## Pack Format (v1.2)

```json
{
  "format": "ai-receipts-forensic-pack/1.2",
  "exportedAt": "ISO 8601 timestamp",

  "segment": {
    "fromSeq": 1,
    "toSeq": 23,
    "eventCount": 23,
    "totalEventsInDb": 23
  },

  "headAtExportTime": {
    "seq": 23,
    "hash": "6584417c..."
  },

  "verification": {
    "algorithm": "SHA-256",
    "canonicalization": "stableStringifyStrict (sorted keys, strict type rejection)",
    "payloadVersion": 1,
    "chainStatus": "LINKED",
    "ok": true,
    "checkedEvents": 23,
    "firstBadSeq": null,
    "breakReason": null
  },

  "system": {
    "semver": "0.2.0",
    "commit": "abc123def456",
    "engineId": "replit-node-verifier/0.2.0",
    "auditPayloadVersion": 1
  },

  "manifest": {
    "toolVersion": "replit-node-verifier/0.2.0",
    "exportScript": "scripts/export_forensic_pack.ts",
    "verifyScript": "scripts/verify_forensic_pack.ts",
    "hashAlgorithm": "SHA-256",
    "signatureAlgorithm": "Ed25519",
    "canonicalizationSpec": "Deterministic JSON: sorted keys, strict type rejection..."
  },

  "events": [
    {
      "seq": 1,
      "ts": "ISO 8601",
      "action": "VERIFY_STORED",
      "actor": "operator",
      "receiptId": "uuid or null",
      "exportId": "null",
      "savedViewId": "null",
      "payload": "{\"key\":\"value\"}",
      "ip": "127.0.0.1",
      "userAgent": "curl/8.0",
      "prevHash": "GENESIS",
      "hash": "sha256 hex",
      "schemaVersion": "audit/1.1",
      "payloadV": 1
    }
  ],

  "checkpoints": [
    {
      "id": "uuid",
      "seq": 100,
      "hash": "sha256 hex matching event at seq 100",
      "ts": "ISO 8601",
      "prevCheckpointId": "null or uuid",
      "prevCheckpointHash": "null or sha256 hex",
      "signatureAlg": "Ed25519",
      "publicKeyId": "key identifier",
      "signature": "base64 Ed25519 signature",
      "signedPayload": "canonical string that was signed",
      "eventCount": 100
    }
  ],

  "anchorReceipts": [
    {
      "anchorType": "log-only | s3-worm | rfc3161",
      "anchorId": "unique anchor identifier",
      "anchoredAt": "ISO 8601",
      "anchorHash": "sha256 of canonical anchorPayload",
      "anchorPayload": {
        "_v": 1,
        "engine_id": "replit-node-verifier/0.2.0",
        "audit_payload_version": 1,
        "checkpoint_id": "uuid",
        "checkpoint_seq": 100,
        "event_seq": 100,
        "event_hash": "sha256 hex",
        "checkpoint_hash": "sha256 hex",
        "kid": "key identifier",
        "created_at": "ISO 8601"
      },
      "checkpointId": "uuid",
      "checkpointSeq": 100,
      "proof": {}
    }
  ],

  "packHash": "sha256 of the pack JSON before this field was added"
}
```

---

## Verification Algorithm

The offline verifier replays the exact same hash chain algorithm used by the running system:

### Step 1: Pack integrity

Recompute SHA-256 of the pack JSON (without the `packHash` field). If it doesn't match `packHash`, the file has been modified.

### Step 2: Sequence continuity

Events must have contiguous sequence numbers starting from `fromSeq`.

### Step 3: Hash chain replay

For each event:

1. Build the canonical payload using `auditPayloadV1()`:
   ```json
   {
     "_v": 1,
     "schemaVersion": "audit/1.1",
     "seq": N,
     "ts": "...",
     "action": "...",
     "actor": "...",
     "receiptId": null,
     "exportId": null,
     "savedViewId": null,
     "payload": { parsed JSON },
     "ip": "...",
     "userAgent": "...",
     "prevHash": "..."
   }
   ```

2. Canonicalize using `stableStringifyStrict()`:
   - Sort all object keys alphabetically
   - Reject undefined, BigInt, Date, Map, Set, RegExp, Buffer, functions, symbols, NaN/Infinity, circular references, dangerous keys

3. Compute `SHA-256(canonicalized_string)` → this must equal `event.hash`

4. The current event's `prevHash` must equal the previous event's `hash` (or "GENESIS" for seq 1)

### Step 4: Head consistency (full exports only)

If the export covers all events, verify that the last event's seq/hash matches `headAtExportTime`.

---

## What This Proves

### To a third-party reviewer

1. **Integrity** — Every event in the segment has a valid SHA-256 hash computed from its canonical representation
2. **Ordering** — Events are sequentially numbered with no gaps
3. **Chain linkage** — Each event's `prevHash` matches the previous event's `hash`
4. **Self-contained** — Verification requires no network access, no database, no API keys

### What it does NOT prove

1. **Completeness** — A partial export only covers the exported segment
2. **Semantic truth** — Hashes prove integrity, not that the logged actions were correct
3. **External anchoring** — The pack is only as trustworthy as its export moment; external WORM storage or signed checkpoints provide stronger guarantees

---

## Use Cases

| Scenario | How to use |
|----------|-----------|
| Compliance audit | Export full chain, hand pack + verifier to auditor |
| Incident investigation | Export segment around suspicious seq, verify offline |
| Procurement demo | Export, tamper manually, show verifier catches it |
| Regulatory filing | Include pack as evidence artifact |
| Third-party attestation | Auditor runs verifier independently |

---

## CLI Reference

### export_forensic_pack.ts

```
Usage: npx tsx scripts/export_forensic_pack.ts [options]

Options:
  --from N      Start sequence number (default: 1)
  --to N        End sequence number (default: last)
  --output F    Output file path (default: forensic_pack.json)
  --help        Show help

Requires: DATABASE_URL environment variable
```

### verify_forensic_pack.ts

```
Usage: npx tsx scripts/verify_forensic_pack.ts <pack.json> [--public-key key.pem]

Options:
  --public-key F  Ed25519 public key PEM file for checkpoint signature verification

Requires: Node.js with crypto module (no database needed)
Exit codes:
  0 = PASS
  1 = FAIL or error
```
