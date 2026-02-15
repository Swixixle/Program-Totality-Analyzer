# Program Totality Report — Engineer View

**EvidencePack Version:** 1.0
**Tool Version:** 0.1.0
**Generated:** 2026-02-15T09:51:13.461602+00:00
**Mode:** replit
**Run ID:** 0fcc018c3f7e

---

## PTA Contract Audit — Run 0fcc018c3f7e

### 1. System Snapshot

| Measure | Value |
|---------|-------|
| Files Analyzed | 170 |
| Files Seen (incl. skipped) | 196 |
| Files Skipped | 26 |
| Claims Extracted | 30 |
| Claims with Deterministic Evidence | 30 |
| Unknown Governance Categories | 9 |
| Verified Structural Categories | 0 |
| Partial Coverage | Yes |

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

### The frontend is a React 18 Single Page Application (SPA) using Wouter, React Query, shadcn/ui, and Tailwind, built with Vite.
Confidence: 100%
- Evidence: `replit.md:21–31` (hash: `781499375745`)
- Evidence: `vite.config.ts:1–40` (hash: `96baf42b9597`)
- Evidence: `tailwind.config.ts:1–108` (hash: `31d5ee63d324`)

### The backend is implemented in Express version 5 on Node.js 20, exposing a REST API and also running a Python analyzer as a child process.
Confidence: 100%
- Evidence: `replit.md:39–53` (hash: `3e4f72540881`)
- Evidence: `server/index.ts:1` (hash: `e0f9e463cd36`)
- Evidence: `package.json:52` (hash: `e049b398be36`)

### The system uses PostgreSQL 14 or higher as its database, accessed using Drizzle ORM and Zod schemas, with configuration via the environment variable DATABASE_URL.
Confidence: 100%
- Evidence: `drizzle.config.ts:3–14` (hash: `a19790628fbe`)
- Evidence: `replit.md:63–72` (hash: `e0a878245f72`)
- Evidence: `server/db.ts:7` (hash: `a19790628fbe`)

### The system includes a Python 3.11+ analyzer as a CLI tool, implemented with Typer, openai, and rich; LLM integration is optional.
Confidence: 100%
- Evidence: `pyproject.toml:5–13` (hash: `aa7c5d87614c`)
- Evidence: `README.md:37` (hash: `b0533af62fac`)
- Evidence: `replit.md:54–61` (hash: `ffe1d23f37ee`)

## Verified: Capability Map

### All critical secrets are detected as names only, never as secret values.
Confidence: 85%
- Evidence: `README.md:146` (hash: `68ac2dc8bd72`)

### The system deterministically parses and extracts run, development, build, and configuration commands using both Python and Node code.
Confidence: 90%
- Evidence: `README.md:65–71` (hash: `f1b901847390`)

### Evidence-cited runbooks are produced in both JSON and Markdown formats.
Confidence: 90%
- Evidence: `README.md:14` (hash: `aabdc653bc93`)
- Evidence: `README.md:162` (hash: `9ef693b15f92`)

### All outputs record unknowns explicitly in UNKOWN slots or sections.
Confidence: 90%
- Evidence: `README.md:172` (hash: `4ceefe518c1d`)

### LLM-powered context and analysis is available optionally via OpenAI GPT integration.
Confidence: 90%
- Evidence: `README.md:85` (hash: `7fb69856946c`)

## Verified: Data & Security Posture

### Critical configuration such as DATABASE_URL, API_KEY, and SESSION_SECRET is injected exclusively via environment variables.
Confidence: 92%
- Evidence: `drizzle.config.ts:3–14` (hash: `a19790628fbe`)

### Session management utilizes express-session with session data stored in PostgreSQL via connect-pg-simple.
Confidence: 95%
- Evidence: `package.json:53` (hash: `abb52cbb888c`)
- Evidence: `package.json:47` (hash: `6441207d984d`)

### No application-layer encryption for stored data is present outside the database or managed SaaS.
Confidence: 80%
- Evidence: `README.md:146` (hash: `68ac2dc8bd72`)
- Evidence: `drizzle.config.ts:3–14` (hash: `a19790628fbe`)

### API_KEY is required for access to protected endpoints such as POST /api/audit/verify.
Confidence: 88%
- Evidence: `server/routes.ts:132` (hash: `29576b54e255`)

### Static assets are served from the dist/public directory, with index.html as a fallback.
Confidence: 90%
- Evidence: `server/static.ts:6–17` (hash: `c41538d1ccce`)
- Evidence: `server/static.ts:13` (hash: `8db433315870`)

## Verified: Dependencies & Maintainability

### The system depends on regular npm and Python dependency maintenance, as reflected in package.json and pyproject.toml.
Confidence: 85%
- Evidence: `package.json:1–115` (hash: `021fb596db81`)
- Evidence: `pyproject.toml:5–13` (hash: `aa7c5d87614c`)

## Verified: How to Use the Target System (Operator Manual)

### Node.js (version 20 or higher) and npm must be installed to operate the system.
Confidence: 90%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)

### Python 3.11 or higher must be installed for the analyzer component.
Confidence: 90%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)
- Evidence: `pyproject.toml:5` (hash: `aa7c5d87614c`)

### PostgreSQL 14 or higher is required and must be running and accessible, configured via DATABASE_URL.
Confidence: 90%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)
- Evidence: `drizzle.config.ts:3` (hash: `a19790628fbe`)

### The system's database schema is synchronized using `npm run db:push`, which runs drizzle-kit push.
Confidence: 90%
- Evidence: `package.json:11` (hash: `3a8be55004c2`)

### In development, the application is started by running `npm run dev`, exposing the app on http://localhost:5000.
Confidence: 92%
- Evidence: `.replit:2` (hash: `96fa2e5505e4`)
- Evidence: `server/index.ts:92–96` (hash: `75d345a78f84`)

### In production, the app is built with `npm run build` and started with `npm run start`.
Confidence: 90%
- Evidence: `package.json:8–9` (hash: `79d8bdf275d6`)

## Verified: Integration Surface

### All API endpoints use JSON, including forensic pack export.
Confidence: 85%
- Evidence: `README.md:19` (hash: `cd74ab1e2399`)
- Evidence: `README.md:28` (hash: `9a52d9b535eb`)

### REST API endpoints are exposed under /api/, including /api/projects, /api/health, /api/ready, and /api/audit/verify (which is protected by API_KEY).
Confidence: 92%
- Evidence: `server/routes.ts:15–59` (hash: `f7ba68760271`)
- Evidence: `server/routes.ts:132` (hash: `29576b54e255`)

## Verified: Operational Reality

### The backend binds to 0.0.0.0 on the port specified by the PORT environment variable, defaulting to 5000.
Confidence: 90%
- Evidence: `server/index.ts:92–96` (hash: `75d345a78f84`)
- Evidence: `.replit:14` (hash: `2cb616fc39c1`)

### Health and readiness are exposed via /api/health and /api/ready endpoints.
Confidence: 88%
- Evidence: `server/routes.ts:15` (hash: `f7ba68760271`)

### In production, static assets are served from dist/public.
Confidence: 90%
- Evidence: `server/static.ts:13` (hash: `8db433315870`)

### Logging is performed using console.log by default; no persistent log files or rotation procedures are implemented.
Confidence: 80%
- Evidence: `server/index.ts:25–34` (hash: `b67bee9a2cd5`)

## Verified: Replit Execution Profile

### On Replit, the app requires Node.js 20, Python 3.11+, and PostgreSQL (via .replit modules).
Confidence: 85%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)

### External OpenAI API is referenced for LLM, audio, chat, and image integrations.
Confidence: 81%
- Evidence: `server/replit_integrations/audio/client.ts:1` (hash: `1d3dd608c3bb`)
- Evidence: `server/replit_integrations/audio/routes.ts:3` (hash: `2f87d29d3b03`)

## Verified: Unknowns / Missing Evidence

### There is no evidence of custom PostgreSQL role or initialization scripts.
Confidence: 85%
- Evidence: `README.md:146` (hash: `68ac2dc8bd72`)
- Evidence: `drizzle.config.ts:3–14` (hash: `a19790628fbe`)

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
| deployment_topology | UNKNOWN | Candidate artifact files found (Dockerfile) but artifact detector not yet implemented — cannot read/hash/verify file content |
| runtime_iam | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| logging_sink | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| monitoring_alerting | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| backup_retention | UNKNOWN | No matching infrastructure/config artifacts found in file index |
| data_residency | UNKNOWN | No matching infrastructure/config artifacts found in file index |

## Snippet Hashes (52 total)

- `021fb596db81`
- `05da5f1b1281`
- `1d2e07b09d7a`
- `1d3dd608c3bb`
- `1f70e6a77d42`
- `232f2a0c483a`
- `24b9d5caf118`
- `29576b54e255`
- `2cb616fc39c1`
- `2f87d29d3b03`
- `31d5ee63d324`
- `3a8be55004c2`
- `3e4f72540881`
- `4124e323d038`
- `47abfb4488e8`
- `4994405dd75c`
- `4be7c6195f60`
- `4ceefe518c1d`
- `519534c1f466`
- `62fec4db8fd5`
- ... and 32 more
