# Program Totality Report — Engineer View

**EvidencePack Version:** 1.0
**Tool Version:** 0.1.0
**Generated:** 2026-02-15T08:22:31.443810+00:00
**Mode:** local
**Run ID:** acdc46d1589e

---

## PTA Contract Audit — Run acdc46d1589e

### 1. System Snapshot

| Measure | Value |
|---------|-------|
| Files Analyzed | 157 |
| Files Seen (incl. skipped) | 183 |
| Files Skipped | 26 |
| Claims Extracted | 9 |
| Claims with Deterministic Evidence | 7 |
| Unknown Governance Categories | 9 |
| Verified Structural Categories | 0 |
| Partial Coverage | Yes |

### 2. Deterministic Coverage Index (DCI v1)

**Score:** 77.78%
**Formula:** `verified_claims / total_claims`

7 of 9 extracted claims contain hash-verified evidence.

This measures claim-to-evidence visibility only.
It does not measure code quality, security posture, or structural surface coverage.

### 3. Reporting Completeness Index (RCI)

**Score:** 36.59%
**Formula:** `average(claims_coverage, unknowns_coverage, howto_completeness)`

| Component | Score |
|-----------|-------|
| claims_coverage | 77.78% |
| unknowns_coverage | 0.00% |
| howto_completeness | 32.00% |

RCI is a documentation completeness metric.
It is not a security score and does not imply structural sufficiency.

### 4. Structural Visibility (DCI v2)

**Status:** not_implemented
**Formula (reserved):** `verified_structural_items / total_structural_surface`

Routes, dependencies, schemas, and enforcement extractors are not active.
Structural surface visibility is intentionally reported as null rather than estimated.
This prevents silent overstatement of governance posture.

### 5. Epistemic Posture

PTA explicitly reports:
- What is deterministically verified.
- What is unknown.
- What is not implemented.
- What requires dedicated extractors.

There is no inference-based promotion from UNKNOWN to VERIFIED.

---

## Verified: How to Use the Target System

### npm script "dev" runs: NODE_ENV=development tsx server/index.ts
Confidence: 60%
- Evidence: `package.json:7` (hash: `fd240a9dc053`)

### npm script "build" runs: tsx script/build.ts
Confidence: 60%
- Evidence: `package.json:8` (hash: `79d8bdf275d6`)

### npm script "start" runs: NODE_ENV=production node dist/index.cjs
Confidence: 60%
- Evidence: `package.json:9` (hash: `020435ddf436`)

## Verified: Integration Surface

### Key dependencies: drizzle-orm, express, openai, react
Confidence: 50%
- Evidence: `package.json:13` (hash: `f7eebadd079d`)

### Database schema/migration files detected: drizzle.config.ts, server/db.ts, shared/schema.ts
Confidence: 40%
- Evidence: `drizzle.config.ts:1` (hash: `1f5c93c3d974`)
- Evidence: `server/db.ts:1` (hash: `3d66d6ea5af3`)

## Verified: What the Target System Is

### The project is named "rest-express" (from package.json)
Confidence: 60%
- Evidence: `package.json:2` (hash: `a1f1a980b4b8`)

### Python project named "program-totality-analyzer" (from pyproject.toml)
Confidence: 50%
- Evidence: `pyproject.toml:2` (hash: `f0d4a96fe7d6`)

## Verified Structural (deterministic extractors only)

- **dependencies**: not_implemented: requires lockfile parser (package-lock.json, requirements.txt, etc.)
- **enforcement**: not_implemented: requires auth/middleware pattern detector over source files
- **routes**: not_implemented: requires AST/regex route extractor over source files
- **schemas**: not_implemented: requires migration/model file parser

## Known Unknown Surface

| Category | Status | Notes |
|----------|--------|-------|
| tls_termination | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| encryption_at_rest | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| secret_management | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| deployment_topology | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| runtime_iam | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| logging_sink | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| monitoring_alerting | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| backup_retention | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| data_residency | UNKNOWN | No matching infrastructure/config artifacts found in file index |

## Snippet Hashes (10 total)

- `020435ddf436`
- `053150b640a7`
- `1f5c93c3d974`
- `3d66d6ea5af3`
- `50c86b7ed8ac`
- `79d8bdf275d6`
- `a1f1a980b4b8`
- `f0d4a96fe7d6`
- `f7eebadd079d`
- `fd240a9dc053`
