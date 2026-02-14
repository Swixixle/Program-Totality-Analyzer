# External Anchoring: What It Prevents and What It Does Not

**Version**: 0.2.0  
**Last updated**: 2026-02-12

---

## Purpose

External anchoring pushes cryptographic evidence outside the primary system's
trust boundary. If the database, operator account, or signing keys are
compromised, external anchors provide independent proof of what existed and when.

---

## What External Anchoring Prevents

### DB Superuser Rewrite (without collusion)

**Threat**: A database administrator rewrites audit events, recomputes the hash
chain, and re-signs checkpoints with the same key.

**Without anchoring**: The rewritten chain is internally consistent and passes
all offline verification.

**With S3 WORM anchoring**: The original checkpoint hashes are stored in an S3
bucket with Object Lock. The rewritten checkpoints produce different hashes that
do not match the S3 objects. Reconciliation fails.

**With RFC3161 TSA anchoring**: The original checkpoint hashes have third-party
timestamps. Rewritten checkpoints would need new timestamps, revealing the
modification timeline.

**Requirement for attack success**: Attacker must compromise both the database
AND the S3 account (or TSA) -- collusion across independent trust boundaries.

### Backdated Modifications

**Threat**: An operator modifies a receipt and claims it was always that way.

**With TSA anchoring**: Each checkpoint has a third-party timestamp that proves
when the hash was first recorded. Backdating requires forging a TSA token from
a trusted authority, which is infeasible.

### Silent Key Rotation Attacks

**Threat**: An operator rotates the signing key, re-signs old checkpoints with
the new key, and rewrites the chain.

**With anchoring**: Anchor receipts include the original `kid` (key identifier)
and checkpoint hash. Even if checkpoints are re-signed, the anchor receipts
preserve the original hashes and kid values.

---

## What External Anchoring Does NOT Prevent

### Pre-Ingestion Tampering

Anchoring proves that data has not been modified *after* it was ingested and
checkpointed. It cannot verify that data was accurately captured in the first
place. If false data enters the system, anchoring preserves the false data
with cryptographic integrity.

### Malicious Operator (from day one)

If the operator controls both the signing key and the anchor account from the
start, they can fabricate the entire chain including anchors. External anchoring
adds collusion cost, not impossibility. The mitigation is organizational: anchor
accounts should be under separate administrative control.

### Anchor Provider Compromise

If the S3 account is compromised (including Object Lock bypass) or the TSA
issues fraudulent tokens, the anchor trust boundary fails. Dual anchoring
(S3 + TSA simultaneously) raises the bar by requiring compromise of both
independent systems.

### Selective Omission

An operator can choose not to anchor certain checkpoints. The verifier reports
anchor coverage (e.g., "3/5 checkpoints anchored") to make gaps visible, but
cannot force the operator to anchor everything.

---

## Anchor Backends

### S3 Object Lock (WORM)

**Trust boundary**: AWS (or compatible S3 provider)

**Retention modes**:
- **GOVERNANCE**: Can be bypassed by principals with `s3:BypassGovernanceRetention`.
  Suitable for pilot/staging. The DB admin must NOT have this permission.
- **COMPLIANCE**: Cannot be bypassed by anyone, including the root account.
  Suitable for production when retention period is well-understood.

**What auditors will probe**:
- "Can an admin bypass Object Lock?" -- Only with Governance mode + explicit
  permission. The IAM policy must deny this.
- "Is the S3 account the same as the DB account?" -- Ideally not. Separate
  accounts prevent single-point compromise.

### RFC3161 Timestamp Authority

**Trust boundary**: The TSA provider (e.g., DigiCert, FreeTSA, Sectigo)

**What it proves**: That a specific hash existed at a specific time, attested
by a trusted third party.

**Offline verifiability**: Timestamp tokens can be verified against the TSA's
certificate chain without contacting the TSA.

**What it does not prove**: That the hash corresponds to honest data. The TSA
timestamps whatever hash you send it.

---

## Recommended Deployment

### Pilot / Staging

```
CHECKPOINT_ANCHOR_TYPE=both
CHECKPOINT_ANCHOR_S3_BUCKET=audit-anchors-staging
CHECKPOINT_ANCHOR_S3_RETENTION_MODE=GOVERNANCE
CHECKPOINT_ANCHOR_S3_RETENTION_DAYS=30
CHECKPOINT_ANCHOR_TSA_URL=https://freetsa.org/tsr
```

### Production

```
CHECKPOINT_ANCHOR_TYPE=both
CHECKPOINT_ANCHOR_S3_BUCKET=audit-anchors-prod
CHECKPOINT_ANCHOR_S3_RETENTION_MODE=COMPLIANCE
CHECKPOINT_ANCHOR_S3_RETENTION_DAYS=365
CHECKPOINT_ANCHOR_S3_CROSS_ACCOUNT_ID=<separate-aws-account-id>
CHECKPOINT_ANCHOR_TSA_URL=https://timestamp.digicert.com
CHECKPOINT_ANCHOR_TSA_FINGERPRINTS=sha256:<digicert-root-fingerprint>
```

### CI / Proof Runs

```
# Dev: log-only (fast, no external dependencies)
npx tsx scripts/proof_run.ts --anchors=optional

# Staging: require real anchors
npx tsx scripts/proof_run.ts --anchors=required
```

---

## Minimal IAM Policy for S3 Anchor Account

The anchor account should have the minimum permissions needed:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAnchorWrite",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectRetention",
        "s3:GetObject",
        "s3:GetObjectRetention",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::audit-anchors-prod",
        "arn:aws:s3:::audit-anchors-prod/*"
      ]
    },
    {
      "Sid": "DenyBypassGovernanceRetention",
      "Effect": "Deny",
      "Action": "s3:BypassGovernanceRetention",
      "Resource": "arn:aws:s3:::audit-anchors-prod/*"
    },
    {
      "Sid": "DenyDeleteAndOverwrite",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:PutBucketObjectLockConfiguration"
      ],
      "Resource": [
        "arn:aws:s3:::audit-anchors-prod",
        "arn:aws:s3:::audit-anchors-prod/*"
      ]
    }
  ]
}
```

**Key properties**:
- Write-only: can create objects but not delete or overwrite
- Cannot bypass governance retention
- Cannot modify the Object Lock configuration itself
- Separate from the DB admin's IAM principal

**Cross-account setup**: The anchor bucket should be in a separate AWS account.
The DB system's IAM role is granted cross-account access via bucket policy,
but the DB account has no ability to modify the bucket's Object Lock settings.

---

## Threat Model Delta

**Before external anchoring** (DB + signing key only):

| Attacker | Can they forge the chain? | Detection |
|----------|--------------------------|-----------|
| DB viewer | No (read-only) | N/A |
| DB writer (no key) | No (can't re-sign) | Signature verification fails |
| DB writer + key holder | Yes | None (internally consistent) |
| DB admin (superuser) + key | Yes | None |

**After external anchoring** (DB + signing key + S3 WORM + TSA):

| Attacker | Can they forge the chain? | Detection |
|----------|--------------------------|-----------|
| DB viewer | No | N/A |
| DB writer (no key) | No | Signature verification fails |
| DB writer + key holder | No | Anchor hashes mismatch |
| DB admin (superuser) + key | No | Anchor hashes mismatch |
| DB admin + key + S3 account | Possible | TSA timestamps reveal backdating |
| DB admin + key + S3 + TSA | Theoretically possible | Requires compromise of 4 independent systems |

The minimum collusion for undetectable forgery goes from **2 parties** (DB + key)
to **4 parties** (DB + key + S3 account + TSA provider).
