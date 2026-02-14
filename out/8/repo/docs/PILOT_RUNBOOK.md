# Pilot Runbook

**Audience**: Technical operator running the first pilot  
**Time to complete**: ~1 hour (including setup)  
**Version**: 0.2.0

---

## Preconditions

Before starting, ensure you have:

| Requirement | How to verify |
|-------------|--------------|
| PostgreSQL database | `DATABASE_URL` env var set; `npm run db:push` succeeds |
| Node.js 20+ | `node --version` returns 20.x or higher |
| API key configured | `SESSION_SECRET` env var set |
| Signing key (optional) | `CHECKPOINT_SIGNING_KEY`, `CHECKPOINT_VERIFY_KEY`, `CHECKPOINT_KEY_ID` set; or ephemeral keys will be generated |
| Anchor credentials (optional) | S3 bucket + IAM or TSA URL; see setup docs below |

### Optional: Set up external anchoring

- **S3 Object Lock**: Follow [PILOT_SETUP_AWS_ANCHOR_ACCOUNT.md](./PILOT_SETUP_AWS_ANCHOR_ACCOUNT.md)
- **TSA provider**: Follow [TSA_PROVIDERS.md](./TSA_PROVIDERS.md)

---

## Step 1: Install and Verify

```bash
git clone <repository-url>
cd ai-receipts
npm ci
npm run db:push
```

Verify the test suite passes:

```bash
npx vitest run --config vitest.config.ts
```

Expected: 72 tests pass across 4 test files.

---

## Step 2: Run Smoke Tests

### Anchor smoke test

```bash
npx tsx scripts/anchor_smoke.ts
```

Expected: "SMOKE TEST PASSED" with all bindings verified.

If external anchors are configured:

```bash
CHECKPOINT_ANCHOR_TYPE=s3-worm \
CHECKPOINT_ANCHOR_S3_BUCKET=your-bucket \
npx tsx scripts/anchor_smoke.ts
```

### TSA smoke test

```bash
npx tsx scripts/tsa_smoke.ts
```

Expected: "TSA SMOKE TEST PASSED" with messageImprint and tamper detection verified.

---

## Step 3: Generate a Proof Bundle

### Without external anchors (development / first run)

```bash
CHECKPOINT_INTERVAL=5 \
PROOF_OUTPUT_DIR=./pilot-proof \
npx tsx scripts/proof_run.ts --anchors=optional
```

### With external anchors (staging / production)

```bash
CHECKPOINT_INTERVAL=5 \
PROOF_OUTPUT_DIR=./pilot-proof \
CHECKPOINT_ANCHOR_TYPE=both \
CHECKPOINT_ANCHOR_S3_BUCKET=your-anchor-bucket \
CHECKPOINT_ANCHOR_TSA_URL=https://freetsa.org/tsr \
npx tsx scripts/proof_run.ts --anchors=required
```

Expected output:

```
=== PROOF RUN COMPLETE ===
  [x] Tests pass
  [x] Audit events generated with checkpoints
  [x] Forensic pack exported with checkpoints + version info
  [x] Offline verification PASS with Ed25519 signature verification
  [x] Tamper detection PASS (verifier catches 1-byte mutation)
  [x] version.json manifest generated
  [x] Public key exported for independent verification
  [x] Anchor receipts: N (backend: ...)
```

---

## Step 4: Export a Forensic Pack

If you want to export from an existing database (not the proof run):

```bash
npx tsx scripts/export_forensic_pack.ts --output forensic_pack.json
```

---

## Step 5: Verify the Pack Offline

### Basic verification (hash chain only)

```bash
npx tsx scripts/verify_forensic_pack.ts pilot-proof/forensic_pack.json
```

### With signature verification (single key)

```bash
npx tsx scripts/verify_forensic_pack.ts pilot-proof/forensic_pack.json \
  --public-key pilot-proof/checkpoint_public.pem
```

### With key ring (supports rotated keys)

```bash
npx tsx scripts/verify_forensic_pack.ts pilot-proof/forensic_pack.json \
  --key-ring keys/
```

### Strict kid mode (refuses to guess keys)

```bash
npx tsx scripts/verify_forensic_pack.ts pilot-proof/forensic_pack.json \
  --key-ring keys/ --strict-kid
```

---

## Step 6: Interpret the Verifier Output

### Healthy output

```
--- Verdict ---
  Integrity:    PASS (chain replay + checkpoint signatures)
  Anchoring:    PRESENT (S3 WORM + RFC3161 coverage)
  Note:         External trust boundaries verified
```

**What this means**: The hash chain is intact, checkpoint signatures are valid, and external anchors confirm the data has not been modified since it was anchored.

### Log-only output

```
--- Verdict ---
  Integrity:    PASS (chain replay + checkpoint signatures)
  Anchoring:    LOG-ONLY (no external trust boundary)
  Note:         DB superuser rewrite resistance is NOT provided
```

**What this means**: The chain is internally consistent, but a DB superuser with the signing key could rewrite it without detection. This is acceptable for development but not for production audits.

### Failure output

```
RESULT: FAIL (hash chain)
  Chain status: BROKEN
  First bad:    seq 7 (hash mismatch)
```

**What this means**: Data has been modified after it was recorded. The specific event where the chain breaks is identified.

---

## Step 7: Build a Verifier Release (Optional)

Package the standalone offline verifier for distribution:

```bash
npx tsx scripts/build_verifier_release.ts
```

This creates a self-contained zip in `releases/` containing the compiled verifier, public key, and README. Recipients can verify packs without installing Node.js or any dependencies.

---

## Artifact Inventory

After a successful proof run, the proof directory contains:

| File | Purpose |
|------|---------|
| `forensic_pack.json` | Complete audit trail with hash chain, checkpoints, anchors |
| `forensic_pack_TAMPERED.json` | Deliberately tampered copy (for tamper detection evidence) |
| `checkpoint_public.pem` | Ed25519 public key for signature verification |
| `anchor_receipts.json` | Raw anchor receipts from all backends |
| `version.json` | Build metadata, test results, anchor status |
| `test_output.txt` | Full test suite output |
| `verify_output.txt` | Clean verification output |
| `tamper_verify_output.txt` | Tamper detection output |
| `export_output.txt` | Export process output |

---

## Next Steps

- Review [EXTERNAL_ANCHORING.md](./EXTERNAL_ANCHORING.md) for threat model analysis
- Review [OBJECTIONS_AND_PRECISE_ANSWERS.md](./OBJECTIONS_AND_PRECISE_ANSWERS.md) for stakeholder Q&A
- Review [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) for non-technical overview
- Share the verifier release zip + forensic pack with your auditor / reviewer
