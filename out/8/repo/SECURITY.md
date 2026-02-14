# SECURITY.md — AI Receipts Security Posture

*Last updated: 2026-02-12*

## What This System Protects

### Data Integrity
- **Receipt hashes**: SHA-256 verification ensures transcript content has not been modified after signing.
- **Receipt chain**: Sequential receipts are cryptographically linked via prev_hash, detecting insertions, deletions, or reordering.
- **Audit trail**: Append-only, hash-chained event log detects unauthorized modifications to operator actions.
- **Immutable lock**: Verified receipts cannot be modified after locking.
- **Kill switch**: Irreversible mechanism to permanently disable interpretation of any receipt.

### Authentication & Authorization
- Private API endpoints require API key via `x-api-key` header.
- Public verification endpoints are read-only with no write capability.
- API keys are stored as environment secrets, never logged or exposed.

### Input Validation
- All request bodies validated with Zod schemas before processing.
- Content-Type enforcement: only `application/json` accepted for POST/PUT/PATCH.
- UTF-8 validation: malformed sequences rejected.
- Request body size limit: 1MB maximum.

### Rate Limiting
- Per-IP burst and sustained rate limits on all API endpoints.
- Public endpoints: 100/min sustained, 10/sec burst.
- Private endpoints: 50/min sustained, 5/sec burst.
- Rate limit headers included in all responses (X-RateLimit-*).

### Response Headers
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing.
- `X-Frame-Options: DENY` — prevents clickjacking.
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage.
- `X-XSS-Protection: 0` — defers to CSP (modern approach).
- `Permissions-Policy` — disables camera, microphone, geolocation.

### LLM Sensor Isolation
- LLMs see ONLY transcript content, never verification data or system state.
- Policy enforcement filters LLM output for forbidden words, confidence boundaries, and hedging requirements.
- `observation_type` field only exists at wire boundaries; internal code uses camelCase.

## What This System Does NOT Protect Against

### Fully-Privileged Database Administrator
A DBA with unrestricted access to the PostgreSQL database can:
- Rewrite all audit trail rows AND the head pointer simultaneously.
- Modify receipt data directly, bypassing API validation.
- Delete or alter any stored data.

**Mitigation**: Anchor the audit trail head hash externally (signed checkpoint, WORM log, or third-party attestation service). This is documented as a future enhancement.

### Network-Level Attacks
- No built-in TLS termination (expected to run behind a reverse proxy or platform like Replit Deployments).
- No mutual TLS for API clients.

### Client-Side Tampering
- The frontend is a read/display layer. All security enforcement happens server-side.
- A malicious client can attempt any API call, but validation and auth gates prevent unauthorized actions.

### Denial of Service
- Rate limiting provides basic protection but is in-memory only (resets on restart).
- No distributed rate limiting or WAF integration.

## Expected Deployment Configuration

### Environment Variables (Required)
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing secret |
| `API_KEY` | API key for private endpoint authentication |

### Environment Variables (Optional)
| Variable | Purpose | Default |
|----------|---------|---------|
| `TRANSCRIPT_MODE` | Display mode: `full`, `redacted`, `hidden` | `full` |
| `PORT` | HTTP listen port | `5000` |

### Deployment Requirements
- Run behind TLS-terminating reverse proxy (Replit Deployments, nginx, Cloudflare).
- PostgreSQL 14+ with connection pooling recommended for production.
- Set `NODE_ENV=production` for production builds.
- Ensure `SESSION_SECRET` and `API_KEY` are cryptographically random (32+ bytes).

### Logging & Monitoring
- All API requests logged with method, path, status, and duration.
- Auth failures, rate limit hits, and payload rejections logged with IP.
- Prompt injection attempts flagged and logged.
- No secrets or API keys are ever included in logs.

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly. Do not open a public issue.
