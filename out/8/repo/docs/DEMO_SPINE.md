# Demo Spine — Operator Walkthrough (6-8 minutes)

**Audience:** CISO, GC, CTO, procurement reviewer
**Premise:** This system proves *integrity of AI outputs/events* without claiming semantic truth. It provides tamper-evidence and operator-grade verification, not truth arbitration.

---

## Setup

All authenticated endpoints require the `x-api-key` header. In development, use `dev-test-key-12345`.

```bash
export API_KEY="dev-test-key-12345"
export BASE="http://localhost:5000"
```

---

## Minute 0-1: Premise

> "This system proves integrity of AI outputs without claiming semantic truth. We do tamper-evidence and operator-grade verification, not truth arbitration."

Key distinction to establish upfront:
- **"Verified"** means cryptographically intact, not factually correct
- **"Broken"** means tampered or corrupted, not necessarily wrong

---

## Minute 1-2: Health vs Ready

### Liveness (no DB dependency)

```bash
curl -s $BASE/api/health | jq .
```

Expected:
```json
{
  "status": "ok",
  "time": "2026-02-12T...",
  "version": "replit-node-verifier/0.1.0"
}
```

**If you see this:** system process is alive. No database dependency.

### Readiness (DB + audit head)

```bash
curl -s $BASE/api/ready | jq .
```

Expected (healthy):
```json
{
  "status": "ok",
  "ready": true,
  "time": "2026-02-12T...",
  "version": "replit-node-verifier/0.1.0",
  "db": { "ok": true },
  "audit": { "ok": true }
}
```

**If you see `"status": "degraded"`:** DB is up but audit head is inconsistent. System still serves traffic (anti-flap design prevents load balancer churn).

**If you get HTTP 503:** DB is unreachable. Only then does the system report not-ready.

---

## Minute 2-4: Audit Chain Verification

### Verify full chain

```bash
curl -s -H "x-api-key: $API_KEY" "$BASE/api/audit/verify" | jq .
```

Expected (healthy chain):
```json
{
  "ok": true,
  "status": "LINKED",
  "checked": 42,
  "checkedEvents": 42,
  "totalEvents": 42,
  "partial": false,
  "head": { "seq": 42, "hash": "a1b2c3..." },
  "expectedHead": { "seq": 42, "hash": "a1b2c3..." },
  "firstBadSeq": null,
  "break": null
}
```

**Interpretation guide:**
| Field | Meaning |
|-------|---------|
| `ok: true` | No integrity violations found |
| `status: "LINKED"` | Multiple events, all hash-chained correctly |
| `partial: false` | All events were checked (no cap hit) |
| `firstBadSeq: null` | No corruption detected |

### Verify a segment (cursor-based)

```bash
curl -s -H "x-api-key: $API_KEY" "$BASE/api/audit/verify?fromSeq=1&toSeq=10" | jq .
```

**If you see `"partial": true`:** Only the requested segment was verified, not the full chain. This is expected for cursor queries.

### Detect tampering

After intentionally corrupting a row (e.g., modifying a hash in the DB), re-run verify:

```bash
curl -s -H "x-api-key: $API_KEY" "$BASE/api/audit/verify" | jq .
```

Expected (broken chain):
```json
{
  "ok": false,
  "status": "BROKEN",
  "checked": 5,
  "checkedEvents": 5,
  "totalEvents": 42,
  "partial": false,
  "head": { "seq": 5, "hash": "..." },
  "firstBadSeq": 6,
  "break": {
    "seq": 6,
    "reason": "hash_mismatch",
    "expectedHash": "abc...",
    "foundHash": "xyz..."
  }
}
```

**If you see `firstBadSeq: 6`:** The chain is intact through event 5, but event 6 has been tampered with. The system pinpoints exactly where corruption begins.

---

## Minute 4-5: Boundary Invariant (Trust Boundary)

### The rule

Wire format (HTTP API) uses `observation_type` (snake_case).
Internal code uses `observationType` (camelCase).
Conversion happens ONLY in `server/llm/wire-boundary.ts`.

### CI enforcement

The GitHub Actions CI pipeline includes a boundary drift guard:
- Grep-based check that `observation_type` only appears in explicitly allowed files
- Build fails if any new file uses `observation_type` outside the boundary

### Test coverage (7 boundary tests)

- Valid wire values map correctly to internal enum
- Invalid wire values throw at the boundary
- Round-trip: internal -> wire -> internal produces identical value
- No internal pipeline object contains `observation_type`
- Adapter options correctly wrap the wire field

---

## Minute 5-6: Error Discipline / Operator Ergonomics

### JSON 404 for unknown API routes

```bash
curl -s $BASE/api/nonexistent | jq .
```

Expected:
```json
{
  "error": {
    "code": 404,
    "message": "Not found",
    "detail": "No route matches GET /api/nonexistent"
  }
}
```

**Why this matters:** No HTML fallback. Every `/api/*` route returns structured JSON, even on 404. External integrations never get confused by SPA HTML.

### Rate limiting on verify

```bash
curl -s -D- -H "x-api-key: $API_KEY" "$BASE/api/audit/verify" 2>&1 | grep -i "x-ratelimit"
```

Expected headers:
```
x-ratelimit-limit: 50
x-ratelimit-remaining: 49
x-ratelimit-reset: 1707700000
```

### Metrics (operator telemetry)

```bash
curl -s -H "x-api-key: $API_KEY" "$BASE/api/health/metrics" | jq .
```

Expected:
```json
{
  "counters": {
    "audit.append.ok": 42,
    "audit.verify.ok": 3,
    "http.GET./api/audit/verify.200": 3
  }
}
```

---

## Minute 6-8: Guarantees + Non-Goals

### What this system guarantees

1. **Integrity** — SHA-256 hash chain detects any modification, deletion, or reordering of audit events
2. **Reproducibility** — Deterministic canonicalization (`stableStringifyStrict`) ensures identical inputs always produce identical hashes
3. **Verification contract** — `ok: true` means the chain is intact; `ok: false` means it is not; `firstBadSeq` pinpoints where
4. **Partial coverage honesty** — `partial: true` is always reported when the full chain was not checked
5. **Boundary discipline** — Wire and internal naming conventions are enforced at build time

### What this system does NOT guarantee

1. **Semantic truth** — "Verified" means cryptographically intact, not factually correct
2. **Completeness beyond cap** — Server-side cap (50,000 events) means very large chains require segmented verification
3. **AI correctness** — LLM observations describe content; they never judge truth
4. **Full-privilege DB defense** — An admin who rewrites ALL rows + head simultaneously can forge a valid chain. External anchoring (WORM storage, signed checkpoints) is recommended for that threat level.

---

## Running the Demo

```bash
# From the project root:
bash scripts/demo.sh
```

The script runs each step above with formatted output and pauses between sections.
