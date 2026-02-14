# Program Totality Report — Engineer View

**EvidencePack Version:** 1.0
**Generated:** 2026-02-14T17:07:34.836809+00:00
**Mode:** replit
**Run ID:** 7f85517c76b6

---

## PTA Contract Audit — Run 7f85517c76b6

### 1. System Snapshot

| Measure | Value |
|---------|-------|
| Files Indexed | 141 |
| Claims Extracted | 30 |
| Claims with Deterministic Evidence | 30 |
| Unknown Governance Categories | 9 |
| Verified Structural Categories | 0 |

### 2. Deterministic Coverage Index (DCI v1)

**Score:** 100.00%
**Formula:** `verified_claims / total_claims`

30 of 30 extracted claims contain hash-verified evidence.

This measures claim-to-evidence visibility only.
It does not measure code quality, security posture, or structural surface coverage.

### 3. Reporting Completeness Index (RCI)

**Score:** 61.67%
**Formula:** `average(claims_coverage, unknowns_coverage, howto_completeness)`

| Component | Score |
|-----------|-------|
| claims_coverage | 100.00% |
| unknowns_coverage | 0.00% |
| howto_completeness | 85.00% |

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

## Verified: Architecture Snapshot

### The Program Totality Analyzer uses a React 18 + TypeScript frontend.
Confidence: 100%
- Evidence: `replit.md:21–31` (hash: `781499375745`)

### The backend is implemented with Node.js 20+, Express 5, Drizzle ORM, Zod validation, and Vite middleware.
Confidence: 100%
- Evidence: `replit.md:39–46` (hash: `3e4f72540881`)
- Evidence: `package.json:49–50` (hash: `c65672bd1705`)

### The database used is PostgreSQL 14+ and schemas are defined in shared/zod/TypeScript.
Confidence: 100%
- Evidence: `replit.md:66–69` (hash: `a01caa356215`)
- Evidence: `drizzle.config.ts:9–10` (hash: `1d784df9809a`)

### A Python Typer CLI is provided that performs structural and semantic codebase analysis.
Confidence: 100%
- Evidence: `README.md:22–31` (hash: `92755120ac2c`)
- Evidence: `pyproject.toml:13` (hash: `2528e7d7b2c3`)

### API contracts and schemas are shared between client and server using TypeScript and Zod.
Confidence: 100%
- Evidence: `replit.md:43` (hash: `b5225b713362`)
- Evidence: `tsconfig.json:19–21` (hash: `8d885adc2606`)

## Verified: Build Toolchain

### Frontend is built using Vite + esbuild, with TailwindCSS and PostCSS.
Confidence: 100%
- Evidence: `package.json:82–105` (hash: `bb1a65091c53`)
- Evidence: `postcss.config.js:3–4` (hash: `c17b19549699`)
- Evidence: `tailwind.config.ts:1–108` (hash: `31d5ee63d324`)

### TypeScript is used throughout client, server, and shared code.
Confidence: 100%
- Evidence: `tsconfig.json:1–23` (hash: `021fb596db81`)

## Verified: Data & Security Posture

### Secrets and credentials (such as DATABASE_URL, API_KEY, SESSION_SECRET) are only set via the .env file and never logged or rendered.
Confidence: 100%
- Evidence: `drizzle.config.ts:3,12` (hash: `a19790628fbe`)

### Session management uses express-session with SESSION_SECRET and a PostgreSQL-backed store.
Confidence: 100%
- Evidence: `package.json:51,57` (hash: `7350730f7e87`)

### API key authorization is required for sensitive/private API routes.
Confidence: 100%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:100` (hash: `24b9d5caf118`)

### All requests and payloads are validated with Zod schemas.
Confidence: 100%
- Evidence: `replit.md:43` (hash: `b5225b713362`)
- Evidence: `package.json:79` (hash: `99a7ac896517`)

### Persistent program data (receipts, projects, analysis, audit logs) is stored in PostgreSQL.
Confidence: 100%
- Evidence: `drizzle.config.ts:3,12` (hash: `a19790628fbe`)
- Evidence: `server/db.ts:13` (hash: `111f33de9945`)

### Rate limiting is implemented in-memory per endpoint/client.
Confidence: 100%
- Evidence: `package.json:61` (hash: `250f04bf6675`)
- Evidence: `replit.md:49` (hash: `3c92f08c92eb`)

### Audit and forensic chains use SHA-256 hash chaining and Ed25519 signatures on checkpoints.
Confidence: 100%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:184–186` (hash: `463c7fe1c1a3`)

### No mutable files or data directory exist, all state is in the database.
Confidence: 100%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:218–219` (hash: `407523f87c0c`)

## Verified: How to Use the Target System

### The default method for database schema initialization is 'npm run db:push', which invokes drizzle-kit migrations.
Confidence: 100%
- Evidence: `package.json:11` (hash: `3a8be55004c2`)

## Verified: Identity of Target System

### PTA requires a working PostgreSQL instance; it is not a database engine.
Confidence: 100%
- Evidence: `replit.md:66` (hash: `a01caa356215`)

## Verified: Integration Surface

### All API endpoints use JSON payloads and are validated with Zod.
Confidence: 100%
- Evidence: `replit.md:43` (hash: `b5225b713362`)
- Evidence: `package.json:79` (hash: `99a7ac896517`)

### The RESTful API surface includes health, ready, projects CRUD, analysis trigger, and dossier/result endpoints.
Confidence: 100%
- Evidence: `replit.md:43–51` (hash: `b5225b713362`)
- Evidence: `server/routes.ts:11–93` (hash: `38f928d78ef1`)

### No evidence was found for outbound webhooks or explicit webhook configuration.
Confidence: 80%
- Evidence: `replit.md:43–122` (hash: `b5225b713362`)

### No official SDKs are provided; integration is via HTTP API or CLI.
Confidence: 100%
- Evidence: `replit.md:43–122` (hash: `b5225b713362`)

## Verified: Maintainability & Change Risk

### Client, server, and shared types are strictly enforced via TypeScript and Zod.
Confidence: 100%
- Evidence: `tsconfig.json:2,16–21` (hash: `d8c7681a5ceb`)
- Evidence: `replit.md:19` (hash: `f709cd6bec28`)

## Verified: Operational Reality

### By default, the backend listens on port 5000, overridable via the PORT environment variable, and binds to all interfaces (0.0.0.0).
Confidence: 100%
- Evidence: `server/index.ts:92,96` (hash: `75d345a78f84`)
- Evidence: `.replit:10–14` (hash: `47abfb4488e8`)

### The PTA does not include built-in TLS/SSL support and should be deployed behind a HTTPS reverse proxy.
Confidence: 100%
- Evidence: `README.md:24` (hash: `e3b0c44298fc`)

## Verified: Purpose & Jobs-to-be-done

### All install/run/config/howto instructions are structurally cited to file:line evidence.
Confidence: 100%
- Evidence: `README.md:11,15` (hash: `867ffae0803d`)

## Verified: Replit Execution Profile

### The system is tested and assumed to run on Replit autoscale environments, using Node.js 20, Python 3.11, and PostgreSQL 16+.
Confidence: 100%
- Evidence: `.replit:1–20` (hash: `a5be1ce88381`)

### The Run command for development is 'npm run dev', and for production deployment it is 'node ./dist/index.cjs'.
Confidence: 100%
- Evidence: `.replit:2,18` (hash: `96fa2e5505e4`)
- Evidence: `package.json:7–9` (hash: `fd240a9dc053`)

### Deployment assumes availability of Postgres and secrets, and listens on all interfaces for proxy routing.
Confidence: 100%
- Evidence: `.replit:1–20` (hash: `a5be1ce88381`)

### Nix packages required: nodejs-20, web, python-3.11, postgresql-16, and libxcrypt.
Confidence: 100%
- Evidence: `.replit:1,7` (hash: `a5be1ce88381`)

### The system can reference external OpenAI APIs using the openai Node.js client.
Confidence: 100%
- Evidence: `server/replit_integrations/audio/client.ts:1` (hash: `1d3dd608c3bb`)
- Evidence: `package.json:57` (hash: `e1441b98f418`)

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

## Snippet Hashes (54 total)

- `021fb596db81`
- `111f33de9945`
- `1694391fc721`
- `1d2e07b09d7a`
- `1d3dd608c3bb`
- `1d784df9809a`
- `232f2a0c483a`
- `24b9d5caf118`
- `250f04bf6675`
- `2528e7d7b2c3`
- `27cb50caf049`
- `31d5ee63d324`
- `38f928d78ef1`
- `3a8be55004c2`
- `3c92f08c92eb`
- `3e4f72540881`
- `407523f87c0c`
- `4124e323d038`
- `463c7fe1c1a3`
- `47abfb4488e8`
- ... and 34 more
