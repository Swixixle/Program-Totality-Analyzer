# TSA Providers for Pilot Deployment

**Version**: 0.2.0  
**Last updated**: 2026-02-12

---

## Overview

RFC3161 Timestamp Authorities (TSAs) provide third-party proof that a hash existed at a specific time. This document lists tested TSA providers with their configuration and expected behavior.

---

## Tested Providers

### 1. FreeTSA (Pilot / Testing)

| Field | Value |
|-------|-------|
| **URL** | `https://freetsa.org/tsr` |
| **Cost** | Free |
| **Rate limits** | Undocumented; suitable for testing only |
| **Token format** | RFC3161 |
| **Root CA** | Self-signed (FreeTSA root) |
| **Status** | Tested, working as of 2026-02 |

**Configuration**:

```bash
export CHECKPOINT_ANCHOR_TYPE="rfc3161"   # or "both" for dual anchoring
export CHECKPOINT_ANCHOR_TSA_URL="https://freetsa.org/tsr"
```

**Notes**: FreeTSA is suitable for pilots and testing. It is not recommended for production due to lack of SLA and unknown availability guarantees. The root CA is self-signed, so tokens cannot be verified against a standard public CA chain.

---

### 2. DigiCert (Production)

| Field | Value |
|-------|-------|
| **URL** | `https://timestamp.digicert.com` |
| **Cost** | Free (included with DigiCert certificates) |
| **Rate limits** | Enterprise-grade; suitable for production |
| **Token format** | RFC3161 |
| **Root CA** | DigiCert Trusted Root G4 |
| **Status** | Industry standard; widely used for code signing |

**Configuration**:

```bash
export CHECKPOINT_ANCHOR_TYPE="rfc3161"
export CHECKPOINT_ANCHOR_TSA_URL="https://timestamp.digicert.com"
```

**Notes**: DigiCert's TSA is production-grade with high availability. Tokens can be verified against DigiCert's public root CA, providing a strong third-party trust chain.

---

### 3. Sectigo (Production Alternative)

| Field | Value |
|-------|-------|
| **URL** | `http://timestamp.sectigo.com` |
| **Cost** | Free |
| **Rate limits** | Enterprise-grade |
| **Token format** | RFC3161 |
| **Root CA** | Sectigo (formerly Comodo) |
| **Status** | Widely used for code signing timestamps |

**Configuration**:

```bash
export CHECKPOINT_ANCHOR_TYPE="rfc3161"
export CHECKPOINT_ANCHOR_TSA_URL="http://timestamp.sectigo.com"
```

**Notes**: Note the `http://` protocol -- Sectigo's TSA endpoint uses plain HTTP. The response itself is cryptographically signed, so transport encryption is not required for integrity (the token's signature provides authenticity).

---

## Fingerprint Pinning

For production deployments, pin the TSA certificate fingerprints to prevent trust chain attacks:

```bash
export CHECKPOINT_ANCHOR_TSA_FINGERPRINTS="sha256:<root-fingerprint>"
```

Multiple fingerprints can be comma-separated:

```bash
export CHECKPOINT_ANCHOR_TSA_FINGERPRINTS="sha256:abc123,sha256:def456"
```

### How to obtain a TSA certificate fingerprint

```bash
openssl s_client -connect timestamp.digicert.com:443 -showcerts < /dev/null 2>/dev/null \
  | openssl x509 -fingerprint -sha256 -noout
```

This outputs something like:

```
sha256 Fingerprint=AB:CD:EF:12:34:...
```

Convert to the pinning format by removing colons and lowercasing:

```
sha256:abcdef1234...
```

---

## Recommended Configuration by Environment

| Environment | TSA Provider | Fingerprint Pinning | Notes |
|-------------|-------------|---------------------|-------|
| Development | None (log-only) | N/A | No external dependencies |
| Pilot | FreeTSA | Optional | Free, quick to test |
| Staging | DigiCert | Recommended | Production-like validation |
| Production | DigiCert or Sectigo | Required | Auditor-ready |

---

## Running the TSA Smoke Test

```bash
# Default (FreeTSA)
npx tsx scripts/tsa_smoke.ts

# Custom TSA
CHECKPOINT_ANCHOR_TSA_URL="https://timestamp.digicert.com" npx tsx scripts/tsa_smoke.ts
```

Expected output:

```
[tsa_smoke] === RFC3161 TSA Smoke Test ===
[tsa_smoke] TSA URL: https://freetsa.org/tsr
[tsa_smoke] ...
[tsa_smoke] anchor_hash: OK
[tsa_smoke] messageImprint: OK (SHA-256 of anchorHash)
[tsa_smoke] checkpoint_id binding: OK
[tsa_smoke] kid binding: OK
[tsa_smoke] Tamper detection: OK
[tsa_smoke] === TSA SMOKE TEST PASSED ===
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No live TSA token obtained" | TSA endpoint not reachable or not implemented | Check URL; system still verifies messageImprint binding |
| "messageImprint mismatch" | Anchor hash computation inconsistency | Check that anchor payload canonicalization matches |
| Connection timeout | TSA endpoint down or blocked | Try alternative TSA provider |
| Certificate validation failure | TSA cert expired or rotated | Update fingerprint pinning configuration |
