# STATE.md — AI Receipts System Truth

*Last updated: 2026-02-12*

## Build Health

| Check | Status |
|-------|--------|
| `tsc --noEmit` | CLEAN (0 errors) |
| `npm run build` | CLEAN (client + server) |
| Tests (42 total) | ALL PASSING |
| Server runtime | RUNNING on port 5000 |

## Implemented (ship-ready)

### Core Verification
- SHA-256 hash verification of receipt capsules
- Ed25519 signature verification
- Receipt chain verification (prev_hash linking)
- Canonicalization (c14n-v1) for deterministic hashing
- Immutable lock (verified receipts cannot be modified)
- Kill switch (irreversible, blocks all interpretations)

### Audit Trail (v1.1)
- SHA-256 hash-chained append-only event log
- `stableStringifyStrict`: rejects undefined, BigInt, Date, Map, Set, RegExp, Buffer, functions, symbols, NaN/Infinity, circular refs, dangerous keys (__proto__, constructor, prototype), non-plain objects — all with path-based error messages
- `auditPayloadV1` → `hashAuditPayload` pipeline (single-sourced, shared by append and verify)
- `payload_v` column: optimization hint cross-checked against hash-protected `_v` (self-auditing invariant)
- `payloadV` derived from builder output at write time (append cannot lie)
- Strict mode: `?strict=true` fails if limit < totalEvents (prevents partial-coverage screenshots)
- Transactional append with `FOR UPDATE` row locking
- 12 action types covering full operator workflow
- Partial verification: first-N window by seq, shows "seq 1–N of M"

### Endpoint Contracts

#### `GET /api/health` (liveness — no auth)
Fast, no DB hit. Always returns 200 with JSON:
```json
{ "status": "ok", "time": "...", "version": "..." }
```

#### `GET /api/ready` (readiness — no auth)
Hits DB + audit head. Returns:
```json
{ "status": "ok"|"degraded", "ready": true|false, "db": { "ok": true }, "audit": { "ok": true }, "time": "...", "version": "..." }
```
HTTP 200 when DB is reachable, 503 when DB is down. `status` degrades on either DB or audit head failure.

**Anti-flap design:**
- DB check is `SELECT 1` (fast, deterministic)
- Audit check reads only the `audit_head` singleton row (not full chain verify)
- `ready: true` when DB is up, even if audit head is degraded — prevents load balancer flap
- `ready: false` + 503 only on DB connection failure

#### `GET /api/audit/verify` (authenticated, rate-limited)
Verifies audit chain integrity. Server-side cap: max 50,000 events per request. Rate-limited via `rateLimitVerify`. Returns:
```json
{
  "ok": true|false,
  "status": "EMPTY"|"GENESIS"|"LINKED"|"BROKEN",
  "checked": 42,
  "checkedEvents": 42,
  "totalEvents": 100,
  "partial": true,
  "head": { "seq": 42, "hash": "..." },
  "firstBadSeq": null,
  "break": null
}
```
**Query params**: `limit` (default 5000, max 50000), `strict` (boolean), `fromSeq` (cursor start), `toSeq` (cursor end).
**Cursor-based verification**: `fromSeq`/`toSeq` enable targeted segment verification. When used, head consistency check is skipped and `partial` is always `true`.
**Guarantees**: cryptographic integrity of the audit chain (hash linkage, payload version consistency, sequence continuity).
**Does NOT guarantee**: semantic truth of logged actions, completeness of operator behavior, real-world event accuracy.

#### `GET /api/health/metrics` (authenticated)
Returns in-memory instrumentation counters. Counters reset on restart.

### Forensic Analysis
- Tri-sensor analysis (interpreter, summarizer, claim extractor)
- Forensic detectors (risk keywords, high-entropy patterns, PII heuristics)
- Tamper-evident share packs with hash-chained event log
- Public verification proof packs

### LLM Sensor Integration
- Adapter registry: 11 providers (openai, anthropic, google, xai, meta, mistral, cohere, perplexity, deepseek, qwen, mock)
- Typed tuple registry (`Array<[ProviderName, AdapterFactory]>`)
- Wire format (`observation_type`) isolated to adapter boundary; internal code uses `observationType`
- Policy enforcement: forbidden words, hedging, confidence, limitations
- Data isolation: LLMs see ONLY transcript content, never verification data

### API & Security
- API key authentication for private endpoints
- Per-IP burst and sustained rate limiting (including `rateLimitVerify` on `/api/audit/verify`)
- Input validation via Zod schemas
- Backend pagination with server-side filtering/sorting
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- Standardized error shape via `apiError()` helper
- JSON 404 catch-all for unmatched `/api/*` routes
- `GET /api/health` (no auth): liveness, no DB hit
- `GET /api/ready` (no auth): readiness, DB + audit head, anti-flap design
- `GET /api/health/metrics` (auth required): in-memory counters for audit, policy, adapter, rate-limit events
- Canonical endpoint documentation: `docs/API_CONTRACTS.md`

### Operational Instrumentation
- Structured JSON logging for audit append/fail, verify results, policy violations, adapter errors
- In-memory counters: audit.append.ok/fail, audit.verify.{ok,partial,broken,empty}, policy.violation.{type,total}, adapter.error.{provider,total}, ratelimit.{endpoint,total}
- Wire/internal boundary formalization: `wireToInternalObservationType()` / `internalToWireObservationType()` / `buildAdapterOptions()` in `server/llm/wire-boundary.ts`

### CI/CD
- GitHub Actions workflow (`.github/workflows/ci.yml`): install, typecheck, db:push, test, boundary drift guard, canon drift guard, build on PR + main
- Boundary drift guard: grep-based CI check that `observation_type` only appears in allowed boundary/type/test files
- Canonicalization drift guard: `scripts/ci-canon-drift-guard.sh` enforces single source of truth in `server/audit-canon.ts`

### Ed25519 Signed Checkpoints
- `audit_checkpoints` table: stores signed checkpoint records anchoring audit chain state
- `server/checkpoint-signer.ts`: Ed25519 key management (ephemeral auto-gen or env var keys)
- Configurable interval via `CHECKPOINT_INTERVAL` env var (default 100)
- Each checkpoint signs: seq, hash, timestamp, prev checkpoint link, event count
- Verification endpoint and offline verifier support checkpoint signature verification

### Forensic Export Pack (v1.1)
- `scripts/export_forensic_pack.ts`: exports audit segment with checkpoints, version info, and verification manifest
- `scripts/verify_forensic_pack.ts`: standalone offline verifier with `--public-key` flag for Ed25519 signature verification
- Pack includes: events, checkpoints, system version (semver/commit/engineId), segment metadata, verification result, manifest, and self-integrity hash (`packHash`)
- Documented in `docs/FORENSIC_EXPORT_PACK.md`

### Version Stamping
- `server/version.ts`: centralized semver + git commit tracking
- All forensic packs embed system version info
- Health endpoint uses centralized version string

### Demo & Documentation
- `docs/DEMO_SPINE.md`: scripted 6-8 minute operator walkthrough with exact curl commands and expected outputs
- `scripts/demo.sh`: automated demo runner with formatted output
- `docs/THREAT_MODEL.md` v2: assets/adversaries/mitigations table, operator misuse/misinterpretation section, residual risks
- `docs/REGULATORY_ALIGNMENT.md`: compliance matrix for 21 CFR Part 11, HIPAA, SOC 2, ISO 27001, EU AI Act, NIST AI RMF
- `docs/CRYPTO_AGILITY.md`: signature abstraction, PQC migration roadmap (Ed25519 → ML-DSA), hash chain transition plan

### UI
- Receipt viewer with row virtualization
- Receipt comparison (side-by-side with field deltas)
- Bulk export (JSONL, CSV) with snapshot boundaries
- Saved views for quick filter access
- Governance page with audit trail, verify button, threat model text
- Halo UI control layer
- Global audit integrity banner (top of all pages): verified/partial/broken/degraded states with auto-refresh

## Explicit Invariants

1. `stableStringifyStrict` rejects ambiguous types BEFORE hashing. No silent coercion.
2. `auditPayloadV1()` and `hashAuditPayload()` are the ONLY path to audit hashes. Both append and verify use this pipeline.
3. `payload_v` column MUST equal `_v` in the hashed payload. Verification cross-checks this.
4. `payloadV` is derived from builder output, never hardcoded.
5. Strict verify fails if limit < totalEvents. No partial coverage can display as "OK".
6. Unverified receipts cannot be interpreted.
7. Kill switch is irreversible and blocks all interpretations.
8. Interpretations are append-only.
9. Immutable lock prevents raw JSON modification.
10. LLM observations never affect verification_status (data isolation).
11. `AdapterObservation` does NOT contain `observation_type`. Only `AdapterRequest` and `LlmObservation` use it.

## Threat Model (Audit Trail)

**What it detects:**
- Payload modification (hash_mismatch)
- Row deletion (seq_gap)
- Row reordering (prevHash_mismatch)
- Version column tampering (version_mismatch / unknown_payload_version)

**What it does NOT protect against:**
- Fully-privileged DB admin who rewrites ALL rows + head simultaneously
- For that level: anchor head hash externally (signed checkpoint, WORM log, third-party attestation)

**Self-auditing property:**
- Even if a database administrator edits `payload_v`, verification fails unless the hash-protected `_v` matches

## Known Risks / Technical Debt

1. No request correlation ID threaded through adapter → policy → audit
2. 3 LLM adapter stubs (anthropic, google, etc.) return NOT_IMPLEMENTED — expected until API keys are configured
3. `routes.ts` is 2000+ lines — candidate for splitting by domain
4. Rate limiter is in-memory only (resets on restart)
5. Counters are in-memory only (reset on restart)

## Explicitly Forbidden

- No mock/placeholder data in production paths
- No `JSON.stringify` on intermediate objects for hash computation (manual string building only)
- No `observation_type` field access on `AdapterObservation` type
- No hardcoded `payloadV` — always derived from builder
- No silent fallbacks for type errors — surface explicit errors

## Test Inventory (42 tests)

### Golden Tests (35 tests) — `server/__tests__/golden-audit-chain.test.ts`
- `stableStringifyStrict`: 19 tests (determinism, sorting, type rejection, circular refs, dangerous keys)
- `auditPayloadV1`: 4 tests (_v embedding, JSON parsing, determinism, hash determinism)
- Audit chain integrity: 3 tests (3-event chain + tamper, prevHash alteration, _v in hash)
- Adapter boundary: 2 tests (observation_type not on AdapterObservation, AdapterRequest shape)
- Wire/internal boundary: 7 tests (valid/invalid wire values, identity mapping, adapter options wrapping, drift guard, round-trip stability, recursive snake_case absence)

### E2E Integration Tests (7 tests) — `server/__tests__/audit-e2e.test.ts`
- Health endpoint returns 200 with JSON `{ status: "ok" }`
- Ready endpoint returns 200 with DB/audit status
- Audit verify returns chain status with operator fields (`ok`, `checkedEvents`, `firstBadSeq`)
- Metrics endpoint returns counters object
- Audit append → verify lifecycle (POST events, verify OK)
- Tamper detection (modify row, verify BROKEN with correct `firstBadSeq`)
- Partial coverage indication when limit < total events

Run: `npx vitest run --config vitest.config.ts`

## Top-10 Punchlist (next priority order)

1. Add request correlation ID across adapter → policy → audit
2. ~~Signed checkpoint anchoring (Ed25519 signature every N events)~~ DONE
3. Split `routes.ts` by domain (receipts, audit, exports, sensors)
4. Rate limiter persistence (Redis or DB-backed)
5. Policy enforcement golden test (deterministic output for same input)
6. External anchor sink (WORM storage for checkpoint hashes)
7. Bulk export streaming for large datasets
8. Counter persistence (Redis or DB-backed)
9. Role-based access control (RBAC) for regulatory alignment
10. Constant-time comparison for auth key validation
