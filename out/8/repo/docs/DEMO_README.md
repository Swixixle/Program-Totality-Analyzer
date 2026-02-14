# HALO-RECEIPTS Demo Guide

**For evaluators, investors, and compliance reviewers.**

This guide walks you through the full verification flow in under 5 minutes. No trust required -- you can verify every claim yourself.

---

## What This System Does

HALO-RECEIPTS provides cryptographic verification for AI conversation transcripts. It proves whether a transcript has been tampered with, without exposing the transcript content.

**It does NOT:**
- Judge whether AI responses are true or correct
- Determine if conversations are complete
- Moderate content
- Monitor conversations in real time

See [PROOF_SPINE.md](./PROOF_SPINE.md) for the full invariant specification.

---

## 5-Minute Evaluator Walkthrough

### Step 1: Open the App

Navigate to the deployed HALO-RECEIPTS application.

### Step 2: Verify a Demo Receipt (ProofPack Lookup)

1. On the **Verify** page, toggle the **"ProofPack lookup"** switch
2. Click the **"Try Demo"** button -- this pre-fills a known-good receipt ID
3. Click **Verify**
4. You should see three green badges:
   - **HASH**: MATCH (SHA-256 integrity confirmed)
   - **SIGNATURE**: Shows signature status
   - **AUDIT CHAIN**: Shows chain link status

**What just happened**: The system looked up a pre-verified receipt and returned its cryptographic proof status. No transcript content was returned.

### Step 3: Try the Proof-Gated Lantern

1. Navigate to the **Lantern** page (sidebar)
2. Click **"Try Demo"** -- pre-fills the demo receipt ID
3. Type any question (e.g., "What was discussed?")
4. Click **Send**
5. Lantern responds because the receipt is VERIFIED

**What just happened**: Lantern checked the receipt's proof status before responding. If the receipt were tampered with or unverified, Lantern would refuse.

### Step 4: Test the Proof Gate (Optional)

1. On the **Lantern** page, clear the receipt ID
2. Enter a fake ID like `fake-receipt-999`
3. Type a question and click Send
4. Lantern refuses with a clear error: "Receipt not found"

This demonstrates the proof gate -- Lantern cannot be tricked into responding about unverified data.

---

## Verification Kit (HALO-RECEIPTS Repo)

For offline, independent verification:

```bash
git clone <repo-url>
npm install
npm test           # 72 tests -- golden tests, E2E, key rotation, anchoring
npm run e2e        # End-to-end proof generation
```

The verification kit runs entirely offline. No API keys, no network calls, no trust assumptions.

---

## Architecture at a Glance

```
Receipt Capsule (JSON)
       |
       v
  Canonicalize (c14n-v1)
       |
       v
  SHA-256 Hash  -----> Compare with declared hash
       |
       v
  Ed25519 Verify -----> Check against key registry
       |
       v
  Chain Link ---------> Verify previous receipt hash
       |
       v
  ProofPack (no transcript, proofs only)
       |
       v
  Lantern (proof-gated conversations)
```

---

## What "VERIFIED" Means Operationally

| Check | Method | What It Proves |
|-------|--------|----------------|
| Hash | SHA-256 of c14n-v1 canonical form | Transcript bytes unchanged since capture |
| Signature | Ed25519 with registered key | Signer identity matches registered key |
| Chain | Previous receipt hash linkage | Ordering integrity across receipts |

**VERIFIED** = all three checks pass.

**VERIFIED does NOT prove**: truth, completeness, authorship intent, AI correctness.

---

## Key Endpoints

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `GET /api/proofpack/:id` | Proof status lookup | None |
| `POST /api/lantern/followup` | Proof-gated Q&A | None |
| `GET /api/health` | System liveness | None |
| `GET /api/ready` | Readiness + DB check | None |

---

## Security Properties

- **No transcript exposure**: ProofPack returns hashes and status, never message content
- **Append-only audit trail**: Every operation is logged with hash chain
- **Ed25519 signed checkpoints**: Periodic audit snapshots signed with asymmetric keys
- **Rate limiting**: Per-IP burst and sustained limits on all endpoints
- **Kill switch**: Irreversible lockout of individual receipts

---

## Questions?

See:
- [PROOF_SPINE.md](./PROOF_SPINE.md) -- System invariants
- [NON_GOALS.md](./NON_GOALS.md) -- What this system explicitly does not do
- [OBJECTIONS_AND_PRECISE_ANSWERS.md](./OBJECTIONS_AND_PRECISE_ANSWERS.md) -- Stakeholder Q&A
- [WHAT_THIS_PROVES.md](./WHAT_THIS_PROVES.md) -- Detailed proof claims
