# AI Receipts API Guide

> **How to Verify a Receipt**

> **Security Notice:** Client applications MUST follow the proxy pattern described in [CLIENT_INTEGRATION.md](./CLIENT_INTEGRATION.md). Direct browser access to authenticated endpoints is unsupported and considered a security violation.

## Quick Start

### 1. Submit a Receipt for Verification

```bash
curl -X POST https://your-domain/api/verify \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "schema": "ai-receipt/1.0",
    "receipt_id": "sample-receipt-001",
    "platform": "openai",
    "captured_at": "2024-01-15T10:30:00.000Z",
    "capture_agent": "browser-extension/1.0",
    "transcript": {
      "embedded": true,
      "canonicalization": "c14n-v1",
      "messages": [
        {"role": "user", "content": "Hello, world!"},
        {"role": "assistant", "content": "Hello! How can I help you today?"}
      ]
    },
    "transcript_hash_sha256": "abc123...",
    "signature": {
      "alg": "Ed25519",
      "public_key_id": "test-key-001",
      "value": "base64-signature..."
    }
  }'
```

### 2. Get Public Verification Status

```bash
curl https://your-domain/api/public/receipts/sample-receipt-001/verify
```

### 3. Get Integrity Proof Pack

```bash
curl https://your-domain/api/public/receipts/sample-receipt-001/proof
```

---

## API Endpoints

### Public Endpoints (No Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/receipts/:id/verify` | Get verification status |
| GET | `/api/public/receipts/:id/proof` | Get integrity proof pack |
| GET | `/health` | Health check |

### Private Endpoints (API Key Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/verify` | Submit receipt for verification |
| GET | `/api/receipts` | List all receipts |
| GET | `/api/receipts/:id` | Get receipt detail |
| POST | `/api/receipts/:id/kill` | Engage kill switch |
| POST | `/api/receipts/:id/observe` | Create LLM observation |
| POST | `/api/receipts/:id/observe/multi` | Multi-model observation |

### Authentication

Add the `x-api-key` header to all private endpoint requests:

```bash
curl -H "x-api-key: YOUR_API_KEY" https://your-domain/api/receipts
```

---

## Response Examples

### Successful Verification (200 OK)

```json
{
  "schema": "ai-receipt/public-verify/1.0",
  "receipt_id": "sample-receipt-001",
  "platform": "openai",
  "captured_at": "2024-01-15T10:30:00.000Z",
  "verified_at": "2024-01-15T10:30:05.000Z",
  "verification_status": "VERIFIED",
  "kill_switch_engaged": false,
  "integrity": {
    "hash_match": true,
    "computed_hash_sha256": "abc123...",
    "expected_hash_sha256": "abc123..."
  },
  "signature": {
    "status": "VALID",
    "public_key_id": "test-key-001",
    "issuer_label": "Test Issuer"
  },
  "chain": {
    "status": "GENESIS",
    "is_genesis": true
  }
}
```

### Proof Pack Response (200 OK)

```json
{
  "schema": "ai-receipt/proof-pack/1.0",
  "receipt_id": "sample-receipt-001",
  "platform": "openai",
  "captured_at": "2024-01-15T10:30:00.000Z",
  "verified_at": "2024-01-15T10:30:05.000Z",
  "verification_status": "VERIFIED",
  "kill_switch_engaged": false,
  "integrity": {
    "hash_match": true,
    "computed_hash_sha256": "abc123...",
    "expected_hash_sha256": "abc123...",
    "receipt_hash_sha256": "def456...",
    "canonicalization": "c14n-v1"
  },
  "signature": {
    "status": "VALID",
    "algorithm": "Ed25519",
    "public_key_id": "test-key-001",
    "issuer_id": "test-issuer",
    "issuer_label": "Test Issuer",
    "key_governance": {
      "key_status": "ACTIVE",
      "valid_from": "2024-01-01T00:00:00.000Z",
      "valid_to": null,
      "revoked_reason": null
    }
  },
  "chain": {
    "status": "GENESIS",
    "previous_receipt_id": null,
    "previous_receipt_hash": null,
    "is_genesis": true,
    "link_verified": true
  },
  "proof_scope": ["integrity", "signature", "chain"],
  "proof_scope_excludes": ["truth", "completeness", "authorship_intent"],
  "_contract": {
    "proof_pack_version": "1.0",
    "transcript_included": false,
    "observations_included": false,
    "research_data_included": false,
    "integrity_proofs_only": true
  }
}
```

---

## Error Responses

### Receipt Not Found (404)

```json
{
  "schema": "ai-receipt/error/1.0",
  "error": {
    "code": "RECEIPT_NOT_FOUND",
    "message": "Receipt not found"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Rate Limited (429)

```json
{
  "schema": "ai-receipt/error/1.0",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Headers when rate limited:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 60
Retry-After: 30
```

### Unauthorized (401)

```json
{
  "schema": "ai-receipt/error/1.0",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Payload Too Large (413)

```json
{
  "schema": "ai-receipt/error/1.0",
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Request body exceeds size limit"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Verification Status Semantics

| Status | Meaning |
|--------|---------|
| `VERIFIED` | Hash match + VALID signature + valid chain |
| `PARTIALLY_VERIFIED` | Hash match + untrusted/missing signature |
| `UNVERIFIED` | Hash mismatch OR invalid signature OR broken chain |

**Important:** `VERIFIED` is an integrity claim, NOT a truth claim. See [WHAT_THIS_PROVES.md](./WHAT_THIS_PROVES.md).

---

## Rate Limits

| Endpoint Type | Sustained | Burst |
|---------------|-----------|-------|
| Public | 100/min | 10/sec |
| Private | 50/min | 5/sec |

See [RATE_LIMIT_POLICY.md](./RATE_LIMIT_POLICY.md) for details.

---

## Schema Versions

| Schema | Version | Description |
|--------|---------|-------------|
| `ai-receipt/1.0` | 1.0 | Input receipt capsule |
| `ai-receipt/error/1.0` | 1.0 | Error response envelope |
| `ai-receipt/public-verify/1.0` | 1.0 | Public verify response |
| `ai-receipt/proof-pack/1.0` | 1.0 | Integrity proof pack |
| `transcript-mode-contract/1.1` | 1.1 | Transcript mode contract |
| `llm-observation/1.0` | 1.0 | LLM observation schema |
| `research-dataset/1.0` | 1.0 | Research dataset schema |
