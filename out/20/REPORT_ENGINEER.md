# Program Totality Report — Engineer View

**EvidencePack Version:** 1.0
**Tool Version:** 0.1.0
**Generated:** 2026-02-15T08:09:08.325606+00:00
**Mode:** replit
**Run ID:** f9762762e0c5

---

## PTA Contract Audit — Run f9762762e0c5

### 1. System Snapshot

| Measure | Value |
|---------|-------|
| Files Analyzed | 143 |
| Files Seen (incl. skipped) | 168 |
| Files Skipped | 25 |
| Claims Extracted | 17 |
| Claims with Deterministic Evidence | 15 |
| Unknown Governance Categories | 9 |
| Verified Structural Categories | 0 |
| Partial Coverage | Yes |

### 2. Deterministic Coverage Index (DCI v1)

**Score:** 88.24%
**Formula:** `verified_claims / total_claims`

15 of 17 extracted claims contain hash-verified evidence.

This measures claim-to-evidence visibility only.
It does not measure code quality, security posture, or structural surface coverage.

### 3. Reporting Completeness Index (RCI)

**Score:** 50.08%
**Formula:** `average(claims_coverage, unknowns_coverage, howto_completeness)`

| Component | Score |
|-----------|-------|
| claims_coverage | 88.24% |
| unknowns_coverage | 0.00% |
| howto_completeness | 62.00% |

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

## Verified: Data & Security Posture

### System requires 3 secret(s): DATABASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL
Confidence: 55%
- Evidence: `drizzle.config.ts:3` (hash: `a19790628fbe`)
- Evidence: `server/replit_integrations/audio/client.ts:10` (hash: `05da5f1b1281`)
- Evidence: `server/replit_integrations/audio/client.ts:11` (hash: `1f70e6a77d42`)

### Secret "DATABASE_URL" is referenced in 4 file(s)
Confidence: 50%
- Evidence: `drizzle.config.ts:3` (hash: `a19790628fbe`)
- Evidence: `drizzle.config.ts:12` (hash: `1005be19f14a`)

### Secret "AI_INTEGRATIONS_OPENAI_API_KEY" is referenced in 3 file(s)
Confidence: 50%
- Evidence: `server/replit_integrations/audio/client.ts:10` (hash: `05da5f1b1281`)
- Evidence: `server/replit_integrations/chat/routes.ts:6` (hash: `05da5f1b1281`)

### Secret "AI_INTEGRATIONS_OPENAI_BASE_URL" is referenced in 3 file(s)
Confidence: 50%
- Evidence: `server/replit_integrations/audio/client.ts:11` (hash: `1f70e6a77d42`)
- Evidence: `server/replit_integrations/chat/routes.ts:7` (hash: `1f70e6a77d42`)

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

### Server binds to 0.0.0.0 (all interfaces)
Confidence: 55%
- Evidence: `server/index.ts:92` (hash: `75d345a78f84`)
- Evidence: `server/index.ts:96` (hash: `9b7206f3d09a`)

### Server port is configured via environment variable
Confidence: 55%
- Evidence: `server/index.ts:92` (hash: `75d345a78f84`)
- Evidence: `server/index.ts:96` (hash: `9b7206f3d09a`)

### Replit run command: npm run dev
Confidence: 55%
- Evidence: `.replit:2` (hash: `96fa2e5505e4`)
- Evidence: `.replit:5` (hash: `550b970621c2`)

## Verified: Integration Surface

### Key dependencies: drizzle-orm, express, openai, react
Confidence: 50%
- Evidence: `package.json:13` (hash: `f7eebadd079d`)

### External API dependency: OpenAI
Confidence: 45%
- Evidence: `server/replit_integrations/audio/client.ts:1` (hash: `1d3dd608c3bb`)
- Evidence: `server/replit_integrations/audio/routes.ts:3` (hash: `2f87d29d3b03`)

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

## Snippet Hashes (20 total)

- `020435ddf436`
- `053150b640a7`
- `05da5f1b1281`
- `1005be19f14a`
- `1d3dd608c3bb`
- `1f5c93c3d974`
- `1f70e6a77d42`
- `2f87d29d3b03`
- `3d66d6ea5af3`
- `50c86b7ed8ac`
- `550b970621c2`
- `75d345a78f84`
- `79d8bdf275d6`
- `96fa2e5505e4`
- `9b7206f3d09a`
- `a19790628fbe`
- `a1f1a980b4b8`
- `f0d4a96fe7d6`
- `f7eebadd079d`
- `fd240a9dc053`
