# Program Totality Report — Engineer View

**EvidencePack Version:** 1.0
**Tool Version:** 0.1.0
**Generated:** 2026-02-15T09:44:03.830102+00:00
**Mode:** replit
**Run ID:** 9c854166a5b8

---

## PTA Contract Audit — Run 9c854166a5b8

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

### The backend API is built with Node.js 20 and Express 5, and uses Drizzle ORM for database access.
Confidence: 95%
- Evidence: `package.json:2` (hash: `a1f1a980b4b8`)
- Evidence: `package.json:52` (hash: `e049b398be36`)
- Evidence: `package.json:49` (hash: `c65672bd1705`)

### The frontend is implemented with React 18, Vite, Tailwind CSS, and shadcn/ui, using TanStack React Query and Wouter.
Confidence: 90%
- Evidence: `package.json:65` (hash: `bd12df8fa4a7`)
- Evidence: `package.json:43` (hash: `e3c68edd1c1e`)
- Evidence: `package.json:73` (hash: `5282b79d11e3`)
- Evidence: `components.json:7` (hash: `efe6263ea01e`)

### The analyzer component is a separate Python CLI, requiring Python 3.11+, and is implemented with Typer.
Confidence: 95%
- Evidence: `pyproject.toml:5` (hash: `aa7c5d87614c`)
- Evidence: `pyproject.toml:12` (hash: `2528e7d7b2c3`)

### Persistent data storage is handled by PostgreSQL 14+, with schema and migrations managed by Drizzle Kit.
Confidence: 95%
- Evidence: `drizzle.config.ts:10` (hash: `d3b6ea7904ab`)
- Evidence: `drizzle.config.ts:9` (hash: `1d784df9809a`)

### Shared types and schemas are located in the monorepo's shared/ directory and are validated using Zod.
Confidence: 85%
- Evidence: `package.json:79` (hash: `99a7ac896517`)
- Evidence: `replit.md:17-19` (hash: `6ff71f3c7f43`)

## Verified: Capability Map

### Three analysis modes are supported: github, local, and replit, selectable through CLI options or server routes.
Confidence: 85%
- Evidence: `README.md:56-58` (hash: `4bc5d8e7df37`)

### The analyzer can optionally use the OpenAI API for LLM-assisted analysis if Replit-provided keys are present.
Confidence: 85%
- Evidence: `README.md:67` (hash: `a9752f3ed93e`)
- Evidence: `server/replit_integrations/audio/client.ts:10-11` (hash: `05da5f1b1281`)

### JSON logging is performed and requests/responses are logged to stdout for observability.
Confidence: 80%
- Evidence: `server/index.ts:25-56` (hash: `b67bee9a2cd5`)

### Health and readiness check endpoints are exposed at /api/health and /api/ready.
Confidence: 90%
- Evidence: `server/routes.ts:15-16` (hash: `f7ba68760271`)

### No database engine is embedded in the application; it requires an external PostgreSQL instance.
Confidence: 85%
- Evidence: `drizzle.config.ts:10` (hash: `d3b6ea7904ab`)

## Verified: Data & Security Posture

### Database connectivity requires the DATABASE_URL environment variable to be set, and will throw if missing.
Confidence: 95%
- Evidence: `drizzle.config.ts:3-5` (hash: `a19790628fbe`)

### Session handling is implemented with express-session, and requires a session secret which can be persisted to the database.
Confidence: 90%
- Evidence: `package.json:53` (hash: `abb52cbb888c`)
- Evidence: `package.json:47` (hash: `6441207d984d`)

### Protected API endpoints require an API_KEY via the x-api-key header.
Confidence: 90%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:100` (hash: `24b9d5caf118`)

### The system does not extract or log secret values: only environment variable names are processed by the analyzer, not their values.
Confidence: 85%
- Evidence: `README.md:146` (hash: `68ac2dc8bd72`)

### Forensic proof is provided through SHA-256 snippet hashing of all cited evidence in dossiers and packs.
Confidence: 85%
- Evidence: `README.md:109-110` (hash: `0aa927984035`)
- Evidence: `README.md:132` (hash: `87c85e98aeb0`)

### API rate limiting is enforced to prevent abuse.
Confidence: 85%
- Evidence: `package.json:61` (hash: `250f04bf6675`)

### There is no evidence of advanced authentication models such as OAuth, SSO, or RBAC in the codebase.
Confidence: 80%
- Evidence: `package.json:62` (hash: `c0ddb2654ff4`)
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:100` (hash: `24b9d5caf118`)

## Verified: How to Use the Target System

### The application is started in development mode using 'npm run dev', which launches both frontend and backend.
Confidence: 90%
- Evidence: `.replit:2` (hash: `96fa2e5505e4`)
- Evidence: `package.json:7` (hash: `fd240a9dc053`)

### Schema migrations and database initialization are performed via the command 'npm run db:push'.
Confidence: 90%
- Evidence: `package.json:11` (hash: `3a8be55004c2`)

### Environment variables required for operation include DATABASE_URL, API_KEY, SESSION_SECRET, and AI_INTEGRATIONS_OPENAI_API_KEY/BASE_URL for LLM-powered features.
Confidence: 85%
- Evidence: `.replit:13-14` (hash: `935a2054e3dd`)
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:91` (hash: `ecd94c8e718d`)
- Evidence: `server/replit_integrations/audio/client.ts:10-11` (hash: `05da5f1b1281`)

## Verified: Integration Surface

### The REST API is served at /api/* endpoints for project, analysis, health, readiness, and audit proofs.
Confidence: 90%
- Evidence: `server/routes.ts:20-51` (hash: `ccd87d48a478`)

### OpenAI LLM integration is enabled via environment variables and only if keys are configured.
Confidence: 90%
- Evidence: `server/replit_integrations/audio/client.ts:10-11` (hash: `05da5f1b1281`)

## Verified: Operational Reality

### Production build is generated using Vite for the frontend and esbuild for backend via 'npm run build'.
Confidence: 90%
- Evidence: `package.json:8` (hash: `79d8bdf275d6`)
- Evidence: `script/build.ts:41` (hash: `1764d5ada25f`)

### The server binds to all interfaces (0.0.0.0) on the port specified by the PORT environment variable (default 5000).
Confidence: 90%
- Evidence: `server/index.ts:92-96` (hash: `75d345a78f84`)
- Evidence: `.replit:14` (hash: `2cb616fc39c1`)

### The application can be run in Replit's autoscale environment and expects all required environment variables to be set in the deployment environment.
Confidence: 85%
- Evidence: `.replit:17` (hash: `d4194baf965a`)
- Evidence: `.replit:13-14` (hash: `935a2054e3dd`)

### The analyzer's Python CLI and its dependencies are installed via pip using 'pip install -e .'.
Confidence: 80%
- Evidence: `README.md:25` (hash: `92755120ac2c`)

### For development, Node.js 20+, Python 3.11+, and PostgreSQL 14+ are required and exposed as modules in Replit.
Confidence: 80%
- Evidence: `.replit:1` (hash: `a5be1ce88381`)

### The system does not include deployment or orchestration frameworks such as Docker or systemd out-of-the-box.
Confidence: 80%
- Evidence: `docs/dossiers/lantern_program_totality_dossier.md:11` (hash: `e3b0c44298fc`)

## Verified: Unknowns / Missing Evidence

### No evidence was found for persistent log file paths, log file rotation, or central error collection.
Confidence: 80%
- Evidence: `server/index.ts:25-56` (hash: `b67bee9a2cd5`)
- Evidence: `.replit:1` (hash: `a5be1ce88381`)

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

## Snippet Hashes (51 total)

- `05da5f1b1281`
- `0aa927984035`
- `1764d5ada25f`
- `1d784df9809a`
- `1f70e6a77d42`
- `232f2a0c483a`
- `24b9d5caf118`
- `250f04bf6675`
- `2528e7d7b2c3`
- `2cb616fc39c1`
- `3a8be55004c2`
- `4124e323d038`
- `4994405dd75c`
- `4bc5d8e7df37`
- `4be7c6195f60`
- `519534c1f466`
- `5282b79d11e3`
- `62fec4db8fd5`
- `6441207d984d`
- `66a8604b5116`
- ... and 31 more
