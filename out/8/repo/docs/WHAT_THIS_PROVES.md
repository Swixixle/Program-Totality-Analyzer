# What AI Receipts Proves (and What It Does Not)

> **Schema Version:** ai-receipt/proof-pack/1.0

## What This System DOES Prove

A verified receipt proves **only the following integrity properties**:

### 1. Transcript Integrity (`proof_scope: "integrity"`)
- The transcript hash matches: `computed_hash_sha256 === expected_hash_sha256`
- The canonicalization method was applied consistently (`c14n-v1`)
- The transcript content has not been altered since capture

### 2. Signature Validity (`proof_scope: "signature"`)
- The Ed25519 signature was verified against the registered public key
- The key was in ACTIVE status at verification time (not REVOKED or EXPIRED)
- The key belongs to a registered issuer in the key registry

### 3. Chain Continuity (`proof_scope: "chain"`)
- For LINKED receipts: `previous_receipt_hash === observed_hash` of prior receipt
- For GENESIS receipts: This is the first receipt in a chain
- Chain integrity proves temporal ordering within a chain

---

## What This System Does NOT Prove

**`proof_scope_excludes`** explicitly declares what is NOT proven:

### 1. Truth (`excludes: "truth"`)
- **No claim about factual accuracy** of statements in the transcript
- LLMs may hallucinate; this system cannot detect hallucinations
- "VERIFIED" means integrity-verified, NOT truth-verified

### 2. Completeness (`excludes: "completeness"`)
- **No claim that the transcript is complete**
- Conversations may have been truncated before capture
- Messages may have been omitted before signing

### 3. Authorship Intent (`excludes: "authorship_intent"`)
- **No claim about why the conversation happened**
- Cannot prove a human authored the user messages
- Cannot prove the assistant wasn't prompted adversarially

---

## Verification Status Semantics

| Status | Meaning |
|--------|---------|
| `VERIFIED` | Hash match + VALID signature + (LINKED or GENESIS chain) |
| `PARTIALLY_VERIFIED` | Hash match + (UNTRUSTED_ISSUER or NO_SIGNATURE) |
| `UNVERIFIED` | Hash mismatch OR INVALID signature OR BROKEN chain |

**CRITICAL:** `VERIFIED` is an integrity claim, NOT a truth claim.

---

## LLM Observations Are Sensors, Not Arbiters

This system allows LLMs to observe transcripts, but:

1. LLM observations are **strictly descriptive** (paraphrase, tone, structure)
2. LLM observations **NEVER affect** verification_status, signature_status, or chain_status
3. Forbidden words are rejected: "correct", "incorrect", "true", "false", "verified", etc.
4. Multi-model disagreement is displayed **without reconciliation** (no "correct" answer)

---

## Data Isolation Guarantees

| Data Type | Included in Proof Pack? | Included in Public Verify? |
|-----------|------------------------|---------------------------|
| Raw transcript content | NO | Depends on TRANSCRIPT_MODE |
| Integrity proofs (hashes) | YES | YES |
| Signature verification | YES | YES |
| Chain verification | YES | YES |
| LLM observations | NO | NO |
| Research data | NO | NO |

---

## Kill Switch Behavior

When `kill_switch_engaged: true`:
- All interpretations are hidden
- All LLM observations are blocked
- The receipt becomes forensically sealed
- **Irreversible** - cannot be undone

---

## For Independent Verification

Third parties can verify proof packs using:
1. The `receipt_hash_sha256` in the proof pack
2. The canonicalization algorithm (`c14n-v1`)
3. The Ed25519 public key from the key registry
4. Chain hash verification using `previous_receipt_hash`

See `INDEPENDENT_VERIFY.md` for scripts and examples.
