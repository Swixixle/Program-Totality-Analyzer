# Rate Limit Policy

> **Version:** 1.0

## Rate Limits by Endpoint

| Endpoint | Auth Required | Sustained Limit | Burst Limit |
|----------|---------------|-----------------|-------------|
| `GET /api/public/receipts/:id/verify` | No | 100/min | 10/sec |
| `GET /api/public/receipts/:id/proof` | No | 100/min | 10/sec |
| `POST /api/verify` | Yes | 50/min | 5/sec |
| `POST /api/receipts/:id/observe` | Yes | 50/min | 5/sec |
| `POST /api/receipts/:id/observe/multi` | Yes | 50/min | 5/sec |

## Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 100      # Maximum requests per window
X-RateLimit-Remaining: 85   # Requests remaining in window
X-RateLimit-Reset: 45       # Seconds until window resets
```

When rate limited (HTTP 429), responses also include:

```
Retry-After: 30             # Seconds to wait before retrying
```

## Rate Limit Response

When rate limited, you receive:

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

## Best Practices

1. **Monitor headers**: Check `X-RateLimit-Remaining` before making requests
2. **Respect Retry-After**: Wait the specified seconds before retrying
3. **Use exponential backoff**: If still rate limited, increase wait time
4. **Cache responses**: Proof packs are deterministic; cache aggressively
5. **Batch operations**: Prefer fewer requests with more data

## Security Events

Rate limit violations are logged as security audit events:
- Event type: `SECURITY_RATE_LIMIT_EXCEEDED`
- IP address is hashed (first 8 chars of SHA-256)
- No PII or receipt IDs are included in logs

## Request Size Limits

| Limit | Value |
|-------|-------|
| Maximum request body | 100KB |
| Hard reject threshold | 1MB |

Oversized requests receive HTTP 413:

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
