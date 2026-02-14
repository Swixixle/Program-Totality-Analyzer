# Proof Spine v1 -- Invariants and Guarantees

**Version**: 1.0
**Status**: Frozen
**Last updated**: 2026-02-12

---

## What Proof Spine Is

Proof Spine is the canonical verification contract for HALO-RECEIPTS. It defines exactly what the system proves, what it does not prove, and the invariants that all components must uphold.

Every downstream feature (Lantern, export, comparison, governance) consumes the Proof Spine contract. No module may bypass it.

---

## Invariants (Non-Negotiable)

### 1. ProofPack Never Returns Transcript Content

The `/api/proofpack/:receiptId` endpoint returns cryptographic proof metadata only:
- Hash match status (SHA-256 / c14n-v1)
- Signature status (Ed25519)
- Chain link status
- Audit trail summary

It **never** includes:
- Transcript messages
- LLM observations
- Research data
- Raw receipt JSON

This is enforced by the `_contract` field in every ProofPack response:

```json
{
  "_contract": {
    "proof_pack_version": "1.0",
    "transcript_included": false,
    "observations_included": false,
    "research_data_included": false,
    "integrity_proofs_only": true
  }
}
```

### 2. Lantern Refuses Unless ProofPack is VERIFIED

The `POST /api/lantern/followup` endpoint checks:
1. Receipt exists (404 if not)
2. `verification_status === "VERIFIED"` (403 if not)
3. `kill_switch_engaged === false` (403 if engaged)

There is no override, no admin bypass, no "soft mode." If the proof gate fails, Lantern returns a structured refusal with the reason.

### 3. Audit Chain Status Cannot Be Overridden by UI

The audit chain status (`LINKED`, `EMPTY`, `DEGRADED`) is computed server-side from the actual audit event table. The UI displays it but cannot set it. There is no API endpoint that accepts a chain status as input.

### 4. Public Mode is Receipt-ID Only

Public endpoints (`/api/proofpack/:receiptId`) require only a receipt ID. No API key, no authentication token, no session. This makes third-party verification possible without trusting the operator.

### 5. Kill Switch is Irreversible

Once `hindsight_kill_switch` is set to `1` on a receipt, it cannot be reversed. All interpretation and Lantern endpoints check this flag and refuse service.

### 6. Interpretations are Append-Only

No interpretation can be edited or deleted. Each interpretation records the verification status and hash at the time it was created, providing a forensic trail.

---

## Proof Scope

### What VERIFIED Means

A receipt reaches `VERIFIED` status when **all three** conditions hold:
1. **Hash match**: The SHA-256 hash of the c14n-v1 canonicalized transcript matches the declared `transcript_hash_sha256`
2. **Signature valid**: Ed25519 signature verification passes against a registered, active key
3. **Chain intact**: Either this is a genesis receipt or the chain link to the previous receipt verifies

### What VERIFIED Does NOT Mean

VERIFIED says nothing about:
- **Truth**: Whether the conversation actually happened as recorded
- **Completeness**: Whether messages were omitted before capture
- **Authorship intent**: Whether the human meant what they typed
- **AI correctness**: Whether the AI response was accurate or appropriate

These are explicitly listed in every ProofPack under `proof_scope_excludes`.

---

## Endpoint Contracts

| Endpoint | Auth | Returns Transcript | Proof-Gated |
|----------|------|--------------------|-------------|
| `GET /api/proofpack/:receiptId` | None | No | N/A |
| `POST /api/lantern/followup` | None | No | Yes (VERIFIED only) |
| `GET /api/lantern/threads/:receiptId` | None | No | No |
| `GET /api/lantern/thread/:threadId/messages` | None | No | No |
| `POST /api/verify` | API Key | No (hashes only) | N/A |

---

## Durable Threads

Lantern conversations are stored in `threads` and `thread_messages` tables:
- Each thread is bound to a `receipt_id`
- A ProofPack snapshot is frozen at thread creation time
- Messages are append-only (user + assistant roles)
- Thread state persists across sessions

---

## Audit Trail Binding

Every Lantern followup creates an audit event with action `lantern_followup`, recording:
- Receipt ID
- Thread ID
- Client IP
- User agent
- Timestamp

This makes Lantern usage forensically observable.

---

## How to Verify These Invariants

```bash
# 1. ProofPack returns no transcript
curl -s /api/proofpack/<receipt-id> | jq 'has("transcript")'
# Expected: false

# 2. Lantern refuses unverified receipts
curl -s -X POST /api/lantern/followup \
  -H "Content-Type: application/json" \
  -d '{"receiptId":"<unverified-id>","userText":"test"}'
# Expected: 403 with reason

# 3. Kill switch blocks Lantern
# (After engaging kill switch on a receipt)
curl -s -X POST /api/lantern/followup \
  -H "Content-Type: application/json" \
  -d '{"receiptId":"<killed-id>","userText":"test"}'
# Expected: 403 with "Kill switch engaged"
```
