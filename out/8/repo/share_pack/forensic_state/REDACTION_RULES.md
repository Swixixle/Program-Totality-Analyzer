# Redaction Rules

These rules are applied when building the share pack to prevent IP leakage.

**Note:** This file is exempt from forbidden-string detection (it documents the patterns to redact).

## URL Redactions

| Pattern | Replacement |
|---------|-------------|
| `https://*.[PLATFORM_REDACTED].app` | `[DEPLOYMENT_URL_REDACTED]` |
| `https://*.[PLATFORM_REDACTED].dev` | `[DEPLOYMENT_URL_REDACTED]` |
| `http://localhost:*` | `[DEPLOYMENT_URL_REDACTED]` |
| `http://[IP_REDACTED]:*` | `[DEPLOYMENT_URL_REDACTED]` |
| `[REPLIT_URL_REDACTED] | `[REPLIT_URL_REDACTED]` |

## IP Address Redactions

| Pattern | Replacement |
|---------|-------------|
| `\b\d{1,3}(\.\d{1,3}){3}\b` | `[IP_REDACTED]` |

## API Key Redactions

| Pattern | Replacement |
|---------|-------------|
| `x-api-key: *` header values | `[API_KEY_REDACTED]` |
| `[SECRET_REDACTED] | `[SECRET_REDACTED]` |
| `dev-test-key-*` | `[API_KEY_REDACTED]` |

## Receipt ID Redactions

### Synthetic ID Allowlist

The following patterns are allowed and NOT redacted (for test/demo purposes):

| Pattern | Example |
|---------|---------|
| `p0-*` through `p9-*` | `p0-test-receipt`, `p6-demo-123` |
| `test-*` | `test-valid-capsule` |
| `sample-*` | `sample-receipt-001` |
| `mock-*` | `mock-sensor-test` |
| `synthetic-*` | `synthetic-demo-id` |

Regex: `^(p[0-9]+-\|test-\|sample-\|mock-\|synthetic-)`

### UUID Redaction

Any UUID-format string (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) that does NOT match a synthetic pattern is redacted to `[UUID_REDACTED]`.

All other receipt_id values are replaced with `[RECEIPT_ID_REDACTED]`

## Private Key Redactions

| Pattern | Replacement |
|---------|-------------|
| `-----BEGIN PRIVATE KEY-----` | `[PRIVATE_KEY_REDACTED]` |
| `-----BEGIN RSA PRIVATE KEY-----` | `[PRIVATE_KEY_REDACTED]` |
| `-----BEGIN EC PRIVATE KEY-----` | `[PRIVATE_KEY_REDACTED]` |
| Hex strings > 64 chars that look like keys | `[KEY_MATERIAL_REDACTED]` |

## Forbidden Strings (Build Fails If Found)

The share pack build will FAIL if any of these are detected after redaction:
- `.[PLATFORM_REDACTED].app`
- `.[PLATFORM_REDACTED].dev`
- `[PLATFORM_REDACTED].com`
- `x-api-key` (in non-redacted context)
- `[SECRET_NAME_REDACTED]`
- `BEGIN PRIVATE KEY`
- Raw IP addresses matching `\b\d{1,3}(\.\d{1,3}){3}\b`

## Application

Redactions are applied to:
- All `.md` files
- All `.jsonl` files
- All `.txt` files
- All `.json` files (except schema definitions)

Files are processed in-place within `/share_pack/` after copying from source.
