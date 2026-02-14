# Program Totality Analyzer: Comprehensive Target System Dossier

---

## 1. **Identity of Target System**

**What it IS:**  
The target system is the **Program Totality Analyzer**: a full-stack, monorepo-based web application for evidence-bound static and semantic analysis of software projects. It produces comprehensive, evidence-cited technical dossiers (claims, usage manuals, risk assessments, and integration maps) for each analyzed project. Key characteristics:
- **Frontend**: React SPA (Single Page Application) with a modern UI for dossier submission and browsing (replit.md:15–35).
- **Backend**: Node.js + Express API with PostgreSQL for persistent project, analysis, and audit log storage (replit.md:16,41–68).
- **Analyzer**: Python-based CLI performing the actual code analysis; invoked by the backend as a child process (replit.md:54–62).
- **Forensic Integrity**: Every claim made about a project is cited to specific file(s):line(s) with content hashes (README.md:90–106).

**What it is NOT:**
- Not a real-time content moderator or multi-operator live review platform (replit.md:55).
- Not a deployment automation, WORM log replacement, or data lake; it does not provision infrastructure, only analyzes and documents (replit.md:19–22).
- Not a drop-in replacement for robust SIEM/logging frameworks (SECURITY.md:54).

---

## 2. **Purpose & Jobs-to-be-done**

- **Produce Verifiable Dossiers**: Generate highly-attributed, structured dossiers for arbitrary software targets (README.md:3, replit.md:3).
- **Operator Guidance**: Help operators understand how to build, configure, run, and verify a system (README.md:11,135; docs/dossiers/lantern_program_totality_dossier.md:75–146).
- **Risk/Unknowns Identification**: Reveal what the analyzer cannot determine, including operational blind spots (README.md:145; docs/dossiers/lantern_program_totality_dossier.md:155).
- **Compliance & Forensics**: Enable audit-ready technical reporting with file:line evidence supporting regulatory and forensic standards (README.md:28–30).
- **Integration Mapping**: Highlight API, data, and authentication surfaces, and required/optional environment variables (replit.md:159–171).
- **Continuous Verification**: Support scripts and endpoints for verifying audit chains and forensic pack integrity (docs/dossiers/lantern_program_totality_dossier.md:136–146).

---

## 3. **Capability Map**

| Capability                     | Mechanism / Implementation                        | Evidence                              |
|--------------------------------|---------------------------------------------------|---------------------------------------|
| Project Scanning & Indexing    | Python analyzer CLI, invoked by Node backend      | README.md:54–60; replit.md:56–62      |
| Structured Dossier Generation  | Markdown/JSON outputs, evidence per claim         | README.md:11–15,135–146               |
| Health & Ready Endpoints       | `/api/health`, `/api/ready`                      | shared/schema.ts:10                   |
| Deterministic Mode             | `--no-llm` CLI flag disables LLM analysis        | README.md:56–62                       |
| LLM-powered Semantic Analysis  | OpenAI integration, env-configurable              | server/replit_integrations/audio/client.ts:10–11 |
| Environment Verification       | Extracts referenced env vars, never values        | README.md:66–67,172                   |
| Forensic Chain/Pack Export     | Scripts and API for pack generation and verify    | scripts/export_forensic_pack.ts       |
| API Key-protected Endpoints    | `x-api-key` required for sensitive routes         | SECURITY.md:15; .env.example:10       |
| Session Security               | Express-session, connect-pg-simple                | package.json:51,57; .env.example:23   |
| Structured Logging             | Custom console JSON, per-request logging          | server/index.ts:25–55                 |
| CI/CD Integration              | Build scripts, drift guards, reproducible zips    | script/build.ts:38–41; .replit:19     |

---

## 4. **Architecture Snapshot**

- **Monorepo structure**:
    - `client/`: React 18, TypeScript frontend (replit.md:21–31,61)
    - `server/`: Express 5 backend with tsx in development (replit.md:41–45,62)
    - `shared/`: TypeScript types, schemas, routes (replit.md:17–19)
- **Analyzer**: Python 3.11+ CLI, invoked as a child process (replit.md:56–63)
- **Database**: PostgreSQL 14+; accessed via Drizzle ORM (README.md:24; drizzle.config.ts:3,12; server/db.ts:7,13)
- **LLM Integration**: OpenAI API, config via env (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`) (server/replit_integrations/audio/client.ts:10–11)
- **Key Endpoints**: REST API under `/api/`, health checks, analysis, dossiers. Types and schemas shared; see `shared/routes.ts` and replit.md:47–53.
- **Build & Run**: Vite (frontend and middleware dev server), esbuild (server bundle), tsx for dev (package.json:7,8).

---

## 5. **How to Use the Target System**

### Operator Manual

#### A. Prerequisites

1. **Node.js 20+ and npm** are required for all backend/frontend operations (.replit:1; docs/dossiers/lantern_program_totality_dossier.md:79).
2. **PostgreSQL 14+** must be running and accessible via `DATABASE_URL` (README.md:24; .replit:1; drizzle.config.ts:3).
3. **Python 3.11+** is required for analyzer scripts (but NOT runtime of the main app) (.replit:1; docs/dossiers/lantern_program_totality_dossier.md:81).
4. **jq, unzip** if you intend to use export/ops scripts (docs/dossiers/lantern_program_totality_dossier.md:81).
5. **TypeScript, tsx, drizzle-kit** installed as devDependencies (`npm install` will handle; package.json:99,103).
6. **OpenAI API Key** (`AI_INTEGRATIONS_OPENAI_API_KEY`) and Base URL (`AI_INTEGRATIONS_OPENAI_BASE_URL`) are required for LLM-powered features only (server/replit_integrations/audio/client.ts:10–11).

#### B. Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   ```
   (docs/dossiers/lantern_program_totality_dossier.md:86)

2. **Install node dependencies:**
   ```bash
   npm install
   ```
   (docs/dossiers/lantern_program_totality_dossier.md:87–88)

3. **Copy example env file:**
   ```bash
   cp .env.example .env
   ```
   (docs/dossiers/lantern_program_totality_dossier.md:89)

4. **Edit `.env` file** to set required secrets and configuration:
   - Set `DATABASE_URL` (Postgres URI), `API_KEY` (API authentication), `SESSION_SECRET` (session key), `PORT` (default 5000), OpenAI keys if LLM features are used (.env.example:5,10,13–14,23; docs/dossiers/lantern_program_totality_dossier.md:91–92).

5. **Apply database schema:**
   ```bash
   npm run db:push
   ```
   (docs/dossiers/lantern_program_totality_dossier.md:108; package.json:11)

#### C. Running the Application

- **Development mode:**
  ```bash
  npm run dev
  ```
  (package.json:7; .replit:2)

- **Production mode:**
  ```bash
  npm run build
  npm run start
  ```
  (package.json:8–9)

#### D. Usage Examples

- **Health check:**
  ```bash
  curl http://localhost:5000/api/health
  ```
  (docs/dossiers/lantern_program_totality_dossier.md:128)

- **Readiness check:**
  ```bash
  curl http://localhost:5000/api/ready
  ```

- **Audit chain verify (API_KEY required):**
  ```bash
  curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify
  ```
  (docs/dossiers/lantern_program_totality_dossier.md:140)

- **Forensic export:**
  ```bash
  npx tsx scripts/export_forensic_pack.ts --output <pack.json>
  ```

- **Offline forensic verify:**
  ```bash
  npx tsx scripts/verify_forensic_pack.ts <pack.json>
  ```
  (scripts/ci-forensic-gate.sh:42)

#### E. Verification Steps

- Apply schema: `npm run db:push`
- Health check (should return HTTP 200): `curl http://localhost:5000/api/health`
- Audit chain verify: see audit endpoint above

#### F. Common Failures & Fixes

| Symptom                | Cause                 | Fix                                      | Evidence                        |
|------------------------|----------------------|------------------------------------------|---------------------------------|
| 401 Unauthorized       | Wrong/missing API_KEY | Set correct x-api-key, check .env        | SECURITY.md:15                  |
| DB connection error    | Bad DATABASE_URL      | Check credentials/service/version        | drizzle.config.ts:3             |
| Server not running     | App not started/port  | Check logs, ensure PORT=5000, check in-use| .replit:10                      |
| Forensic pack error    | Tamper or script bug  | Re-export, check script present          | scripts/ci-forensic-gate.sh:61–84 |

---

## 6. **Integration Surface**

- **REST API**: Well-documented endpoints, all under `/api/`, including `/api/health`, `/api/ready`, `/api/projects`, `/api/audit/verify`, etc. (replit.md:47–53).
- **API Authentication**: API key for all sensitive endpoints, sent via `x-api-key` header (.env.example:10; SECURITY.md:15).
- **Webhooks**: Unknown — evidence needed: No explicit webhook integration or configuration found in code or docs.
- **Data Formats**: Strict JSON REST; schemas validated via Zod (STATE.md:95; SECURITY.md:20).
- **Forensic Export/Import**: Proof packs as JSON via scripts; offline verifier provided (scripts/export_forensic_pack.ts; STATE.md:123–126).
- **SDKs**: None found; usage via HTTP API or CLI scripts.

---

## 7. **Data & Security Posture**

- **Data Storage**: PostgreSQL 14+ required for all state; referenced by `DATABASE_URL` (drizzle.config.ts:3,12; server/db.ts:7,13).
- **Secrets Handling**: No secrets shipped in source; all must be set in `.env`. Names referenced, never values (README.md:172; .env.example).
- **Authentication**: API_KEY header for sensitive endpoints (SECURITY.md:15–16,72).
- **Session Security**: express-session, connect-pg-simple, key sourced from env (package.json:51,57; .env.example:23).
- **Rate Limiting**: Per-IP, in-memory, resets on process restart (SECURITY.md:26–29; STATE.md:94).
- **Audit Trail**: Hash-linked append-only database tables (STATE.md:25–29).
- **Input Validation**: Zod schemas, 1MB max, UTF-8 only (SECURITY.md:20–23).
- **No Secret Logging**: Secrets never logged (SECURITY.md:17,90).

---

## 8. **Operational Reality**

- **Running**: Start via `npm run dev` (dev) or `npm run build && npm run start` (prod), supports autoscale (e.g., Replit) or manual setup (.replit:2,19; .replit:18).
- **Port**: Always binds to `process.env.PORT` (default 5000), listens on all interfaces (`0.0.0.0`) (server/index.ts:92,96; .env.example:14).
- **Dependencies**: Node.js, PostgreSQL, Python 3.11+ required for all features (.replit:1).
- **No built-in TLS**: Expects to be run behind an HTTPS proxy or on PaaS (README.md:24; SECURITY.md:54).
- **Observability/Logging**: Per-request logging to console (`console.log`/`console.error`, structured, not file-based by default; server/index.ts:25–55).
- **No persistent files**: All app state lives in PostgreSQL; no file-based data directory (STATE.md:219).

---

## 9. **Maintainability & Change Risk**

- **Monorepo structure** minimizes type drift (replit.md:18–19).
- **Typed contracts** via shared schemas (Zod), reducing frontend/backend mismatch (replit.md:89).
- **Build is reproducible**: Clean build scripts; consistent bundling (script/build.ts:38–41; .replit:19,18).
- **Change risks**:
    - **Database migrations**: Uses Drizzle Kit; ensure `npm run db:push` after schema changes.
    - **API Contracts**: Shared definitions, so any schema refactor requires coordination.
    - **Analyzer/Backend Bridge**: Python analyzer is a separate process—protocol changes require dual updates.
- **Missing explicit procedures**:
    - No documented rotation for secrets (API_KEY, SESSION_SECRET).
    - No explicit log review path or log aggregation.
    - No documented procedures for database role management or backup/restore.

---

## 10. **Replit Execution Profile**

### Run command (from .replit)

- **Development**: `npm run dev` (.replit:2)
- **Production (Replit autoscale)**: Built then `node ./dist/index.cjs` (.replit:18)

### Language/Runtime

- **Node.js** (Node 20), Express backend, React frontend (.replit:1, package.json:7).

### Port Binding

- Listens on `0.0.0.0`, port from `process.env.PORT` (default 5000) (server/index.ts:92,96; .env.example:14; .replit:10,14).

### Required Secrets

- `DATABASE_URL` (drizzle.config.ts:3,12; server/db.ts:7,13)
- `AI_INTEGRATIONS_OPENAI_API_KEY` (server/replit_integrations/audio/client.ts:10; server/replit_integrations/chat/routes.ts:6; server/replit_integrations/image/client.ts:6)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` (server/replit_integrations/audio/client.ts:11; server/replit_integrations/chat/routes.ts:7; server/replit_integrations/image/client.ts:7)

### External APIs Referenced

- **OpenAI**: All LLM-powered features require OpenAI API; used in chat, audio, and image integrations (server/replit_integrations/audio/client.ts:1,3; server/replit_integrations/image/client.ts:2).

### Nix Packages Required

- `libxcrypt` only (.replit:7). Other dependencies handled by Node/npx.

### Deployment Assumptions

- Port 5000 is mapped to 80 externally (Replit)
- Requires Node 20, Python 3.11, and PostgreSQL
- No Dockerfile; assumes Replit runner or similar environment (.replit:1,18–19).
- Secrets must be provided in the environment or `.env`

### Observability/Logging

- Per-request logging to `console.log`/`console.error` (server/index.ts:25–55)
- Health endpoint `/api/health` exists (shared/schema.ts:10, server/routes.ts)
- No evidence of persistent log files or log shipping (Unknown — evidence needed)

### Limitations

- **No Dockerfile or containerized deployment configuration**—not portable as a container out of the box (Unknown — evidence needed).
- **No production log file path or log viewing commands**—console only.
- **Frontend build/run process is always coupled to the backend**; no documented flow for "frontend-only" CDN deploy.

---

## 11. **Unknowns / Missing Evidence**

1. **Production deployment details**: No Dockerfile, systemd, or production service configuration found. (Impacts non-Replit ops and packaging.)
2. **Database initialization/roles**: No custom role/user SQL or backup/init strategy documented.
3. **Key rotation/management procedures**: No evidence for rotating or managing API_KEY or SESSION_SECRET.
4. **Log file management**: No explicit evidence/log path/retention config; unclear how to review or aggregate logs.
5. **Standalone frontend build/deploy story**: No explicit documentation or scripts for static frontend hosting/CDN.
6. **Webhooks or outbound integrations**: No code or config describing webhooks or SIEM/SOC events.

---

## 12. **Receipts (Evidence Index)**

(Evidence is cited in the format `file:line`, multiple values per item)

- replit.md:3,4,11–19,21–62,89–104,159–171
- README.md:3,11,24,28–30,32–35,39–62,66–135,145
- package.json:7–9,11,99,103
- drizzle.config.ts:3,12
- server/db.ts:7,13
- .replit:1,2,7,10,14,18–19
- shared/schema.ts:10
- scripts/export_forensic_pack.ts
- scripts/ci-forensic-gate.sh:42,61–84
- server/replit_integrations/audio/client.ts:10–11
- STATE.md:17–29,94–124
- SECURITY.md:15–17,20–23,26–29,32–36,39–40,54,71–84,90
- client/requirements.md:2–10

**Unknowns:**
- No Dockerfile or production automation config found.
- No database roles/init/backup docs found.
- No log file or log review evidence found.
- No non-coupled/standalone frontend deployment flow documented.
- No webhook or SIEM/SOC outbound event integration found.

---

**End of Dossier.**