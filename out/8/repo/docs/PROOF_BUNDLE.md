# Proof Bundle Specification

**Version:** 1.0  
**Last Updated:** 2026-02-12

A proof bundle is the output of `scripts/proof_run.ts`. It provides end-to-end evidence that the system can generate, chain, checkpoint, export, verify, and detect tampering in audit events.

---

## Files in a Bundle

| File | Purpose | What it proves |
|------|---------|---------------|
| `version.json` | Engine version, commit, run metadata | Ties the bundle to a specific build |
| `test_output.txt` | Full test suite output | All invariants held at build time |
| `forensic_pack.json` | Exported forensic pack (format 1.2) with events, checkpoints, anchor receipts | Chain was correctly built and exportable |
| `anchor_receipts.json` | Anchor receipts generated per checkpoint | External anchoring pipeline functional |
| `verify_output.txt` | Verifier output on clean pack | Pack passes offline verification |
| `forensic_pack_TAMPERED.json` | Pack with one mutated event | Control artifact for tamper test |
| `tamper_verify_output.txt` | Verifier output on tampered pack | Verifier detects 1-byte mutation |
| `checkpoint_public.pem` | Ed25519 public key used for signing | Enables independent signature verification |
| `export_output.txt` | Export script output | Export completed without errors |
| `SHA256SUMS.txt` | SHA-256 checksums of all files (release only) | File integrity after download |

---

## Expected Verifier Output (Clean Pack)

```
Forensic Pack Offline Verifier
==============================
Format:      ai-receipts-forensic-pack/1.2
...
Pack integrity: OK (pack hash matches)

RESULT: PASS (hash chain)
  Chain status: LINKED
  Checked:      N/N events
  ...
  Coverage:     FULL
  Head match:   OK (matches head at export time)

Checkpoints:    M found in pack
  Chain:        M checkpoints linked
  Anchors:      M checkpoint-event hashes match
  Signatures:   M/M Ed25519 signatures VERIFIED

Anchors:        M anchor receipts in pack
  Types:        log-only
  Verified:     M/M anchor hashes match
  Log-only:     M anchors (structured log only, no external trust boundary)
```

When external anchoring is configured (S3 WORM or RFC3161 TSA), the anchor section reports the anchor type and relevant proof details:

```
Anchors:        M anchor receipts in pack
  Types:        s3-worm, rfc3161
  Verified:     M/M anchor hashes match
  S3 WORM:      K anchors (K with object hash, requires live S3 access to verify)
  RFC3161:      J anchors (J with TSA token)
```

---

## Expected Verifier Output (Tampered Pack)

```
FAIL at seq K: hash mismatch
  Expected: <recomputed hash>
  Found:    <stored hash>
```

Or if the pack envelope was also recalculated:

```
FAIL: Pack integrity check failed.
  Expected pack hash: ...
  Computed pack hash: ...
```

---

## What a Failure Means

| Failure | Interpretation | Action |
|---------|---------------|--------|
| `test_output.txt` shows failures | Core invariants broken | Do not release; fix tests first |
| `verify_output.txt` shows FAIL | Chain was not correctly built | Bug in event generation or canonicalization |
| `tamper_verify_output.txt` shows PASS | Verifier failed to detect tampering | Critical bug in verifier |
| Missing `checkpoint_public.pem` | No checkpoints were created | Check CHECKPOINT_INTERVAL setting |
| Signature verification fails | Key mismatch or signing bug | Check key management configuration |

---

## What a Failure Does NOT Mean

- A passing bundle does **not** prove the system is free of all bugs
- A passing bundle does **not** prove semantic truth of any logged content
- A passing bundle does **not** prove the system is secure against all threat actors
- A passing bundle proves the **cryptographic machinery works end-to-end** at build time

---

## Generating a Bundle

```bash
# Default: outputs to artifacts/proof_run/<timestamp>/
npx tsx scripts/proof_run.ts

# Custom output directory
PROOF_OUTPUT_DIR=/tmp/my-bundle npx tsx scripts/proof_run.ts

# With custom checkpoint interval
CHECKPOINT_INTERVAL=5 npx tsx scripts/proof_run.ts
```

Requires: `DATABASE_URL` environment variable pointing to a PostgreSQL database.

---

## Verifying a Bundle Independently

1. Download the bundle zip from the release page
2. Extract and verify file checksums: `sha256sum -c SHA256SUMS.txt`
3. Run the verifier against the pack:
   ```bash
   node verify.js forensic_pack.json --public-key checkpoint_public.pem
   ```
4. Confirm the tampered pack is detected:
   ```bash
   node verify.js forensic_pack_TAMPERED.json --public-key checkpoint_public.pem
   # Should output FAIL
   ```

---

## Artifact Signing (Sigstore Cosign)

Release artifacts are signed using Sigstore Cosign with keyless OIDC (transparency log). This provides cryptographic proof that artifacts were produced by the CI pipeline, not a third party.

### Signed Artifacts

Every release includes `.sig` (signature) and `.pem` (certificate) files alongside each artifact:

- `verifier-vX.Y.Z.zip` + `.sig` + `.pem`
- `proof_run_bundle-vX.Y.Z.zip` + `.sig` + `.pem`
- `SHA256SUMS.txt` + `.sig` + `.pem`
- `SBOM.json` + `.sig` + `.pem`

### Verifying Signatures

```bash
# Install cosign (https://docs.sigstore.dev/cosign/system_config/installation/)
# Then verify any artifact:

cosign verify-blob \
  --signature verifier-vX.Y.Z.zip.sig \
  --certificate verifier-vX.Y.Z.zip.pem \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp "github.com/.*/.github/workflows/release.yml" \
  verifier-vX.Y.Z.zip
```

### Transparency Log

Signatures are recorded in the Rekor transparency log. This means even if the CI system is compromised later, the original signing event is publicly anchored and timestamped.

---

## SBOM (Software Bill of Materials)

Each release includes `SBOM.json` in CycloneDX 1.5 format. The verifier bundles all dependencies (canonicalizer, crypto) into a single JS file with zero external dependencies, so the SBOM is minimal.

### Validate SBOM

```bash
npx @cyclonedx/cyclonedx-cli validate --input-file SBOM.json
```

---

## Reproducibility

The verifier zip is built with deterministic settings:
- Normalized zip timestamps (epoch: 2020-01-01)
- Stable alphabetical file ordering
- Consistent compression level

The release workflow includes a reproducibility gate that rebuilds the zip and compares SHA-256 hashes. If they differ, the release fails.

---

## CI Integration

The proof bundle is generated on every CI build and uploaded as a GitHub Actions artifact (90-day retention). On tagged releases (`v*`), the bundle is included in the GitHub Release alongside the verifier zip, SHA-256 checksums, Sigstore signatures, and SBOM.
