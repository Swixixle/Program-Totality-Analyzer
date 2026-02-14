# API Endpoint Contracts

Canonical documentation for all API endpoints. Each contract specifies the request/response shape, guarantees, and non-guarantees.

---

## Health & Readiness

### `GET /api/health`

**Purpose**: Liveness probe. No DB hit.

| Field | Value |
|-------|-------|
| Auth | None |
| Rate limit | None |
| Response | `{ status: "ok", time: "<ISO 8601>", version: "<engine_id>" }` |
| Status code | Always `200` |
| Guarantee | Returns within 10ms, never touches DB |
| Non-guarantee | Does not prove DB or audit chain are healthy |

### `GET /api/ready`

**Purpose**: Readiness probe. Cheap DB + audit head check.

| Field | Value |
|-------|-------|
| Auth | None |
| Rate limit | None |
| Response | `{ status, ready, time: "<ISO 8601>", version: "<engine_id>", db: { ok }, audit: { ok } }` |
| Status `200` | DB reachable (even if audit head degraded) |
| Status `503` | DB connection failure |
| Anti-flap | Returns 200 when DB is up regardless of audit state to prevent load balancer flapping |
| Guarantee | Does NOT run full chain verification |

### `GET /api/health/metrics`

**Purpose**: In-memory operational counters.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` (API key) |
| Rate limit | None |
| Response | `{ counters: { <key>: <number>, ... } }` |
| Guarantee | Counters are monotonically increasing within a process lifetime |
| Non-guarantee | Counters reset on server restart |

---

## Audit Trail

### `GET /api/audit`

**Purpose**: Paginated audit event list with filtering and sorting.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Rate limit | `rateLimitPublic` |
| Query params | `page`, `limit`, `action`, `receiptId`, `sortBy`, `sortDir` |
| Response | `{ events, total, page, limit, totalPages }` |
| Guarantee | Server-side pagination, max 100 per page |

### `GET /api/audit/verify`

**Purpose**: Full or cursor-based audit chain integrity verification.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Rate limit | `rateLimitVerify` |
| Query params | `limit` (default 5000, max 50000), `strict`, `fromSeq`, `toSeq` |
| Response | `{ ok, status, checked, checkedEvents, totalEvents, partial, head, expectedHead, firstBadSeq, break }` |
| Status values | `EMPTY`, `GENESIS`, `LINKED`, `BROKEN` |
| `ok` field | `true` unless status is `BROKEN` |
| `fromSeq`/`toSeq` | Cursor-based segment verification; skips head consistency check |
| `strict` mode | Fails if limit covers fewer events than total |
| Guarantee | Server-side cap at 50,000 events per call |

---

## Receipts

### `GET /api/receipts`

**Purpose**: Paginated receipt list with filtering and sorting.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Query params | `page`, `limit`, `search`, `verified`, `killSwitched`, `hasInterpretations`, `sortBy`, `sortDir` |
| Response | `{ receipts, total, page, limit, totalPages }` |

### `GET /api/receipts/:id`

**Purpose**: Single receipt detail.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Response | Full receipt object |
| Status `404` | Receipt not found |

### `POST /api/receipts`

**Purpose**: Create a new receipt.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Body | Receipt JSON (validated by Zod schema) |
| Response | Created receipt object |
| Side effect | Appends audit event |

### `POST /api/receipts/:id/verify`

**Purpose**: Verify a receipt's SHA-256 hash.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Response | `{ verified, hash, expectedHash }` |
| Side effect | Updates receipt verified status, appends audit event |

### `POST /api/receipts/:id/kill-switch`

**Purpose**: Irreversibly disable interpretation for a receipt.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Response | Updated receipt |
| Guarantee | Irreversible; blocks all future interpretations |
| Side effect | Appends audit event |

### `POST /api/receipts/:id/lock`

**Purpose**: Immutably lock a receipt against modification.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Precondition | Receipt must be verified |
| Side effect | Appends audit event |

---

## Interpretations

### `GET /api/receipts/:id/interpretations`

**Purpose**: List interpretations for a receipt.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Response | Array of interpretation objects |

### `POST /api/receipts/:id/interpretations`

**Purpose**: Append an interpretation to a receipt.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Precondition | Receipt must be verified and not kill-switched |
| Categories | `FACT`, `INTERPRETATION`, `UNCERTAINTY` |
| Guarantee | Append-only; existing interpretations cannot be modified |

---

## Public Verification

### `POST /api/public/verify`

**Purpose**: Public receipt verification (no auth required).

| Field | Value |
|-------|-------|
| Auth | None |
| Rate limit | `rateLimitPublic` |
| Body | Receipt JSON for hash verification |
| Response | `{ verified, hash }` |
| Security | Request size limited to 1MB |

### `POST /api/public/verify/chain`

**Purpose**: Public receipt chain verification.

| Field | Value |
|-------|-------|
| Auth | None |
| Rate limit | `rateLimitPublic` |
| Body | Array of receipts to verify chain linkage |

### `POST /api/public/proof-pack`

**Purpose**: Generate a cryptographic proof pack for a receipt.

| Field | Value |
|-------|-------|
| Auth | None |
| Rate limit | `rateLimitPublic` |
| Body | Receipt JSON |
| Response | Proof pack with verification artifacts |

---

## Bulk Export

### `POST /api/export/start`

**Purpose**: Start a bulk export job.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Body | Export parameters (format, filters) |
| Response | `{ exportId }` |
| Side effect | Appends audit event |

### `GET /api/export/:id/status`

**Purpose**: Check export job status.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Response | `{ status, progress, downloadUrl }` |

### `POST /api/export/:id/confirm`

**Purpose**: Confirm and finalize an export.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Side effect | Appends audit event |

### `GET /api/export/:id/download`

**Purpose**: Download completed export file.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Response | File download (JSONL or CSV) |
| Side effect | Appends audit event |

---

## Saved Views

### `GET /api/saved-views`

**Purpose**: List saved filter views.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Response | Array of saved view objects |

### `POST /api/saved-views`

**Purpose**: Create a saved view.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Side effect | Appends audit event |

### `DELETE /api/saved-views/:id`

**Purpose**: Delete a saved view.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Side effect | Appends audit event |

---

## Comparison

### `POST /api/compare/viewed`

**Purpose**: Log a receipt comparison view.

| Field | Value |
|-------|-------|
| Auth | `requireAuth` |
| Body | `{ left, right }` receipt IDs |
| Side effect | Appends audit event |

---

## Error Shape

All API errors follow a consistent shape:

```json
{
  "error": {
    "code": 404,
    "message": "Not found",
    "detail": "No route matches GET /api/nonexistent"
  }
}
```

Public endpoint errors use a structured format:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "meta": { "retry_after_seconds": 60 }
  }
}
```

---

## Rate Limit Headers

All rate-limited endpoints return:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests in window |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Window reset timestamp (Unix seconds) |
| `Retry-After` | Seconds until retry (only on 429) |

---

## Security Headers

All responses include:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
