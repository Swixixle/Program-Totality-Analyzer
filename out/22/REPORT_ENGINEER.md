# Program Totality Report — Engineer View

**EvidencePack Version:** 1.0
**Tool Version:** 0.1.0
**Generated:** 2026-02-15T09:50:17.072005+00:00
**Mode:** replit
**Run ID:** 4b663a328ff9

---

## PTA Contract Audit — Run 4b663a328ff9

### 1. System Snapshot

| Measure | Value |
|---------|-------|
| Files Analyzed | 170 |
| Files Seen (incl. skipped) | 196 |
| Files Skipped | 26 |
| Claims Extracted | 30 |
| Claims with Deterministic Evidence | 29 |
| Unknown Governance Categories | 9 |
| Verified Structural Categories | 0 |
| Partial Coverage | Yes |

### 2. Deterministic Coverage Index (DCI v1)

**Score:** 96.67%
**Formula:** `verified_claims / total_claims`

29 of 30 extracted claims contain hash-verified evidence.

This measures claim-to-evidence visibility only.
It does not measure code quality, security posture, or structural surface coverage.

### 3. Reporting Completeness Index (RCI)

**Score:** 60.56%
**Formula:** `average(claims_coverage, unknowns_coverage, howto_completeness)`

| Component | Score |
|-----------|-------|
| claims_coverage | 96.67% |
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

### The backend is built on Node.js 20+ with Express 5, Drizzle ORM for PostgreSQL, and TypeScript.
Confidence: 100%
- Evidence: `package.json:7–11` (hash: `fd240a9dc053`)
- Evidence: `package.json:13–64` (hash: `f7eebadd079d`)
- Evidence: `.replit:1–2` (hash: `a5be1ce88381`)

### The frontend is a React 18 Single Page Application using Wouter, TanStack Query, Tailwind, and shadcn/ui, built with Vite.
Confidence: 100%
- Evidence: `package.json:13–67` (hash: `f7eebadd079d`)
- Evidence: `vite.config.ts:1–40` (hash: `96baf42b9597`)
- Evidence: `tailwind.config.ts:1–108` (hash: `31d5ee63d324`)

### PostgreSQL 14+ is the only database used, with schema versioned via Drizzle Kit and models in shared/schema.ts.
Confidence: 100%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)
- Evidence: `drizzle.config.ts:9–13` (hash: `1d784df9809a`)

### The Python CLI analyzer requires Python 3.11+ and is implemented using Typer.
Confidence: 100%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)
- Evidence: `pyproject.toml:5–12` (hash: `aa7c5d87614c`)

### The backend spawns the Python static analyzer as a subprocess for code analysis.
Confidence: 90%
- Evidence: `replit.md:56–68` (hash: `22085c032d95`)

### All persistent application models are defined in TypeScript under shared/schema.ts and accessed via Drizzle ORM.
Confidence: 85%
- Evidence: `drizzle.config.ts:9–10` (hash: `1d784df9809a`)

### Frontend, backend, and analyzer runtime are all monorepo-managed with TypeScript projects sharing types via @shared/*.
Confidence: 85%
- Evidence: `tsconfig.json:18–21` (hash: `4563730f6bb6`)

### The system supports multi-modal analysis of targets from GitHub, local file system, or Replit workspace.
Confidence: 85%
- Evidence: `README.md:42–65` (hash: `b41698313679`)
- Evidence: `replit.md:57–59` (hash: `55d0d96fe621`)

## Verified: Capability Map

### Every technical dossier claim is bound to specific file:line+hash evidence for reproducibility.
Confidence: 90%
- Evidence: `README.md:95–110` (hash: `5eeb80ed5717`)

### Both deterministic (no LLM) and LLM-powered analysis modes are available in the analyzer.
Confidence: 90%
- Evidence: `README.md:64` (hash: `029820bb5192`)

### The analyzer provides explicit detection and logging of unknown or ambiguous facts, with annotation in dossier output.
Confidence: 85%
- Evidence: `README.md:154` (hash: `7755bc9930ce`)

### Dossier and claim outputs are available in Markdown and structured JSON formats (operate.json, claims.json).
Confidence: 90%
- Evidence: `README.md:13–19` (hash: `70d33f05b06a`)
- Evidence: `README.md:151–183` (hash: `46fe1f323990`)

## Verified: Data & Security Posture

### Session data is persisted using express-session with connect-pg-simple.
Confidence: 100%
- Evidence: `package.json:47,53` (hash: `6441207d984d`)

### All secrets and keys are never logged or exposed by the code, only referenced by variable name.
Confidence: 90%
- Evidence: `drizzle.config.ts:3–5` (hash: `a19790628fbe`)
- Evidence: `README.md:146` (hash: `68ac2dc8bd72`)

### An API_KEY must be supplied via the x-api-key header for privileged API endpoints.
Confidence: 90%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:100` (hash: `24b9d5caf118`)

### Analyzer enforces self-containment avoiding symlink/traversal/binary file issues and collects only safe text evidence.
Confidence: 90%
- Evidence: `README.md:142–145` (hash: `394fca0ca143`)

## Verified: How to Use the Target System

### The development server is started with `npm run dev`, which runs Express and the frontend together on port 5000.
Confidence: 100%
- Evidence: `.replit:2` (hash: `96fa2e5505e4`)
- Evidence: `package.json:7` (hash: `fd240a9dc053`)

### The database schema is applied to PostgreSQL using the `npm run db:push` script, driven by Drizzle Kit.
Confidence: 100%
- Evidence: `package.json:11` (hash: `3a8be55004c2`)
- Evidence: `drizzle.config.ts:9–10` (hash: `1d784df9809a`)

### The application requires Node.js 20+ and npm, PostgreSQL 14+, and Python 3.11+ installed.
Confidence: 100%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)
- Evidence: `pyproject.toml:5` (hash: `aa7c5d87614c`)
- Evidence: `replit.md:79–80` (hash: `63a4573e311e`)

### The production server is started with NODE_ENV=production npm run start, serving backend and static client from dist/index.cjs.
Confidence: 100%
- Evidence: `package.json:8–9` (hash: `79d8bdf275d6`)
- Evidence: `server/index.ts:92` (hash: `75d345a78f84`)

### Required environment variables include DATABASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY, SESSION_SECRET, API_KEY, and PORT (default 5000).
Confidence: 90%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:100–102` (hash: `24b9d5caf118`)
- Evidence: `.replit:14` (hash: `2cb616fc39c1`)
- Evidence: `server/replit_integrations/audio/client.ts:10–11` (hash: `05da5f1b1281`)

### To check audit chain, the toolkit supports an endpoint at /api/audit/verify requiring properly set API keys.
Confidence: 90%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:100` (hash: `24b9d5caf118`)

## Verified: Integration Surface

### All critical configuration, including database URL and API keys, must be set via environment variables in `.env`.
Confidence: 100%
- Evidence: `drizzle.config.ts:3–5` (hash: `a19790628fbe`)
- Evidence: `server/db.ts:7,13` (hash: `a19790628fbe`)

### REST endpoints are provided for project submission, analysis, dossier retrieval, and health checks, all rooted at /api/
Confidence: 100%
- Evidence: `server/routes.ts:15–96` (hash: `f7ba68760271`)

### LLM analysis is enabled via an OpenAI integration using the AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL.
Confidence: 100%
- Evidence: `server/replit_integrations/audio/client.ts:10–11` (hash: `05da5f1b1281`)

## Verified: Operational Reality

### The backend listens on all interfaces (0.0.0.0) at port specified by PORT env variable (default 5000).
Confidence: 100%
- Evidence: `.replit:10,14` (hash: `47abfb4488e8`)
- Evidence: `server/index.ts:92,96` (hash: `75d345a78f84`)

### Build tools include Vite, esbuild, and tsx; the consistency between these tools is critical for proper operation.
Confidence: 100%
- Evidence: `vite.config.ts:1–40` (hash: `96baf42b9597`)
- Evidence: `script/build.ts:41,49–54` (hash: `1764d5ada25f`)
- Evidence: `package.json:8` (hash: `79d8bdf275d6`)
- Evidence: `package.json:103–105` (hash: `8278575b52c0`)

### The system outputs JSON logs for requests and exposes a health check endpoint at /api/health.
Confidence: 100%
- Evidence: `server/index.ts:25–56` (hash: `b67bee9a2cd5`)
- Evidence: `server/routes.ts:15` (hash: `f7ba68760271`)

## Verified: Replit Execution Profile

### Replit deployment is defined by .replit, requiring Node.js, Python, PostgreSQL, and relevant Nix packages in the environment.
Confidence: 100%
- Evidence: `.replit:1–7` (hash: `a5be1ce88381`)

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

## Snippet Hashes (47 total)

- `020435ddf436`
- `029820bb5192`
- `05da5f1b1281`
- `1694391fc721`
- `1708a1dd7c72`
- `1764d5ada25f`
- `1d2e07b09d7a`
- `1d784df9809a`
- `1f70e6a77d42`
- `22085c032d95`
- `232f2a0c483a`
- `24b9d5caf118`
- `27cb50caf049`
- `2cb616fc39c1`
- `31d5ee63d324`
- `394fca0ca143`
- `3a8be55004c2`
- `4563730f6bb6`
- `46fe1f323990`
- `47abfb4488e8`
- ... and 27 more
