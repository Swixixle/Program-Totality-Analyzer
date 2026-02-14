# Pilot Setup: AWS Anchor Account

**Version**: 0.2.0  
**Time to complete**: ~30 minutes  
**Prerequisites**: AWS CLI configured, one or two AWS accounts

---

## Overview

This guide sets up a dedicated AWS account (or bucket) for S3 Object Lock anchoring. The anchor bucket stores cryptographic hashes of audit checkpoints in a tamper-resistant location separate from the primary database.

---

## Step 1: Create the Anchor AWS Account (Recommended)

For production, use a **separate AWS account** from the database account. This prevents a single compromise from covering both the database and the anchors.

For pilot/staging, you can use the same account with a separate IAM user that has no database access.

---

## Step 2: Create the S3 Bucket with Object Lock

```bash
export ANCHOR_BUCKET="ai-receipts-anchors-pilot"
export ANCHOR_REGION="us-east-1"

aws s3api create-bucket \
  --bucket "$ANCHOR_BUCKET" \
  --region "$ANCHOR_REGION" \
  --object-lock-enabled-for-bucket

aws s3api put-bucket-versioning \
  --bucket "$ANCHOR_BUCKET" \
  --versioning-configuration Status=Enabled
```

Object Lock requires versioning to be enabled (it is auto-enabled by `--object-lock-enabled-for-bucket`, but the explicit call ensures it).

---

## Step 3: Configure Default Retention

### Pilot / Staging (GOVERNANCE mode)

GOVERNANCE mode allows users with `s3:BypassGovernanceRetention` to delete objects before retention expires. Good for testing.

```bash
aws s3api put-object-lock-configuration \
  --bucket "$ANCHOR_BUCKET" \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Days": 30
      }
    }
  }'
```

### Production (COMPLIANCE mode)

COMPLIANCE mode makes objects undeletable by anyone (including root) until retention expires. Use only when you are confident in the retention period.

```bash
aws s3api put-object-lock-configuration \
  --bucket "$ANCHOR_BUCKET" \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Days": 365
      }
    }
  }'
```

---

## Step 4: Create the Anchor IAM User/Role

Create a dedicated IAM user for the anchoring service with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAnchorOperations",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectRetention",
        "s3:GetObject",
        "s3:GetObjectRetention",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ai-receipts-anchors-pilot",
        "arn:aws:s3:::ai-receipts-anchors-pilot/*"
      ]
    },
    {
      "Sid": "DenyGovernanceBypass",
      "Effect": "Deny",
      "Action": "s3:BypassGovernanceRetention",
      "Resource": "arn:aws:s3:::ai-receipts-anchors-pilot/*"
    },
    {
      "Sid": "DenyDestructiveOperations",
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:PutBucketObjectLockConfiguration",
        "s3:DeleteBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ai-receipts-anchors-pilot",
        "arn:aws:s3:::ai-receipts-anchors-pilot/*"
      ]
    }
  ]
}
```

Save this as `anchor-policy.json` and attach it:

```bash
aws iam create-user --user-name ai-receipts-anchor

aws iam put-user-policy \
  --user-name ai-receipts-anchor \
  --policy-name AnchorBucketAccess \
  --policy-document file://anchor-policy.json

aws iam create-access-key --user-name ai-receipts-anchor
```

Save the access key ID and secret key securely.

---

## Step 5: Cross-Account Setup (Production)

If the anchor bucket is in a different account than the application:

### In the anchor account: Add bucket policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCrossAccountAnchorWrite",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::APPPLICATION_ACCOUNT_ID:role/ai-receipts-app"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectRetention",
        "s3:GetObject",
        "s3:GetObjectRetention"
      ],
      "Resource": "arn:aws:s3:::ai-receipts-anchors-prod/*"
    }
  ]
}
```

### In the application account: Allow the role to assume cross-account access

The application's IAM role needs permission to write to the anchor bucket in the other account. The bucket policy above grants it.

---

## Step 6: Configure Environment Variables

Set these in your application environment:

```bash
# Required
export CHECKPOINT_ANCHOR_TYPE="s3-worm"
export CHECKPOINT_ANCHOR_S3_BUCKET="ai-receipts-anchors-pilot"

# Optional (defaults shown)
export CHECKPOINT_ANCHOR_S3_PREFIX="checkpoints/"
export CHECKPOINT_ANCHOR_S3_RETENTION_DAYS="30"
export CHECKPOINT_ANCHOR_S3_RETENTION_MODE="GOVERNANCE"

# Cross-account (production only)
export CHECKPOINT_ANCHOR_S3_CROSS_ACCOUNT_ID="123456789012"
```

For dual anchoring (S3 + TSA), use:

```bash
export CHECKPOINT_ANCHOR_TYPE="both"
export CHECKPOINT_ANCHOR_S3_BUCKET="ai-receipts-anchors-pilot"
export CHECKPOINT_ANCHOR_TSA_URL="https://freetsa.org/tsr"
```

---

## Step 7: Run the Smoke Test

```bash
npx tsx scripts/anchor_smoke.ts
```

Expected output:

```
[anchor_smoke] S3 WORM Anchor Smoke Test
[anchor_smoke] Bucket: ai-receipts-anchors-pilot
[anchor_smoke] Retention: GOVERNANCE / 30 days
[anchor_smoke] Writing test anchor...
[anchor_smoke] Verifying anchor receipt...
[anchor_smoke] anchor_hash: OK
[anchor_smoke] objectHash: OK
[anchor_smoke] objectBody binding: OK
[anchor_smoke] PASS: S3 anchor write + verify succeeded
```

---

## Step 8: Run Proof with Required Anchors

```bash
CHECKPOINT_INTERVAL=5 npx tsx scripts/proof_run.ts --anchors=required
```

This will fail if anchors are not properly configured, confirming the system refuses to produce proofs without external trust boundaries.

---

## Verification Checklist

- [ ] Bucket created with Object Lock enabled
- [ ] Versioning enabled
- [ ] Default retention configured (GOVERNANCE for pilot, COMPLIANCE for prod)
- [ ] IAM user created with minimal permissions
- [ ] Governance bypass explicitly denied
- [ ] Destructive operations explicitly denied
- [ ] Environment variables set
- [ ] Smoke test passes
- [ ] Proof run with `--anchors=required` succeeds

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Anchor mode is 'required' but only log-only backend configured" | CHECKPOINT_ANCHOR_TYPE not set | Set to "s3-worm" or "both" |
| "Access Denied" on PutObject | IAM policy missing or wrong bucket | Check policy resource ARN matches bucket |
| "Object Lock not enabled" | Bucket created without `--object-lock-enabled-for-bucket` | Cannot be retroactively enabled; recreate bucket |
| Smoke test fails with "objectHash mismatch" | Data corruption in transit | Check network/TLS configuration |
