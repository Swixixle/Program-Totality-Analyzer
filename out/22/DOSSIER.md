# Program Totality Analyzer (PTA) — Technical Dossier

---

## 1. **Identity of Target System**

- **What it IS**:  
  Program Totality Analyzer (PTA) is a full-stack web application and analysis engine that produces evidence-cited technical dossiers for software projects. The system is comprised of:
    - A React frontend for submitting projects (via GitHub, local, or Replit workspace) and viewing results.
    - A Node.js/Express backend, persisting projects and analyses to PostgreSQL via Drizzle ORM, and spawning a Python static analyzer to perform hash-anchored code analysis.
    - A Python CLI analyzer that extracts, models, and verifies project operational facts, binding every claim to file:line+hash evidence.
  [VERIFIED: replit.md:3-4,11–17,21–27; README.md:3,9,10–23,60–61]

- **What it is NOT**:  
  - Not a runtime security scanner, live content moderator, or multi-operator enforcement tool. [VERIFIED: replit.md:55]
  - Not a database engine—uses PostgreSQL for all durable storage. [VERIFIED: replit.md:71–72; drizzle.config.ts:10]
  - Not a generic file storage/archive, nor WORM replacement, nor deployment/orchestration framework. [INFERRED]

---

## 2. **Purpose & Jobs-to-be-done**

- **Forensic technical analysis**: Produce evidence-cited, hash-verifiable dossiers summarizing identity, risks, boot commands, integration points, and unknowns of software projects. [VERIFIED: README.md:13,15–23; replit.md:4,13–19,36–46]
- **Operator enablement**: Document exactly how a target system is run, configured, and integrated—enabling reproducible, trusted handoff. [VERIFIED: replit.md:13–15,94–99]
- **Evidence modeling for trust**: Bind every dossier claim to original file sections, with reproducibility and distrust annotation for ambiguous items. [VERIFIED: README.md:20–21,95–110,164–182]
- **Support compliance/verification**: Output can be used as evidence for internal or external audit. [VERIFIED: README.md:130–133; replit.md:32]

---

## 3. **Capability Map**

| Capability                     | Mechanism / Implementation             | Evidence                                   |
|------------------------------- |--------------------------------------- |--------------------------------------------|
| Static artifact analysis,   | Python CLI using Typer, deterministic+LLM | README.md:24–33,67–74; pyproject.toml:6–13 |
| Evidence-cited findings     | File:line+hash evidence for every claim   | README.md:95–110,146                       |
| Reproducibility / hash      | SHA-256; file existence, snippet re-hash  | README.md:109–132                          |
| Dossier/claim output        | Markdown, JSON: operate.json, claims.json | README.md:13–19,151–183                    |
| API and UI workflows        | REST API, React SPA                      | replit.md:16–18,39–53; shared/schema.ts    |
| Multi-modal analysis modes  | GitHub, local folder, Replit workspace    | README.md:42–65; replit.md:57–59; examples/README.md:14–26 |
| Integration scan            | Endpoints, API keys, webhooks (detect)    | README.md:72,169; replit.md:98–99          |
| LLM-based semantic analysis | OpenAI via Replit integration             | README.md:85; package.json:59              |
| Detected unknowns           | Explicitly logged, with reason            | README.md:154; operate.json, target_howto.json |
| Health/observability        | /api/health, JSON logs                    | server/routes.ts:15; script/build.ts:38    |

[All: VERIFIED via referenced source unless otherwise noted]

---

## 4. **Architecture Snapshot**

- **Frontend:** React 18 (SPA), Wouter router, TanStack Query, Tailwind, shadcn/ui, built with Vite.  [VERIFIED: client/requirements.md:1–6; replit.md:21–38]
- **Backend:** Node.js 20+, Express 5, Drizzle ORM for PostgreSQL, TypeScript, tsx for dev, esbuild/Vite for build.  [VERIFIED: replit.md:39–46; package.json:7–10; script/build.ts:49–54]
- **Database:** PostgreSQL 14+, schema versioned via Drizzle Kit, models in shared/schema.ts. [VERIFIED: drizzle.config.ts:10,13; replit.md:71–74]
- **Analyzer:** Python 3.11+ Typer CLI (`pta`) spawned as a subprocess by the Node backend; can operate deterministically or with LLM support. [VERIFIED: replit.md:56–68; README.md:25–35]
- **Integration:** Replit integrations for OpenAI (AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL). [VERIFIED: package.json:59; server/replit_integrations/audio/client.ts:10–11]

---

## 5. **How to Use the Target System**

### Prerequisites

1. **Node.js 20+ and npm installed.** [VERIFIED: .replit:1; package.json; replit.md:79]
2. **PostgreSQL 14+ running and accessible.** Set up, create database, user, and configure `DATABASE_URL`. [VERIFIED: drizzle.config.ts:3; replit.md:80]
3. **Python 3.11+ and pip installed**, for running the analyzer CLI and scripts. [VERIFIED: .replit:1; pyproject.toml:5; README.md:35]
4. **jq, unzip (optional):** Used in ops/verification scripts. [VERIFIED: replit.md:81]
5. **TypeScript, tsx, drizzle-kit:** Used for TypeScript compilation and DB migrations. [VERIFIED: package.json:10,99,103; replit.md:82]
6. **All required environment variables (DATABASE_URL, API_KEY, SESSION_SECRET, etc) set in `.env`.** [VERIFIED: drizzle.config.ts:3; server/db.ts:7,13; .env.example (INFERRED)]

### Installation

1. **Clone the repository**  
   `git clone <repo>`  
   [VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:86]
2. **Install dependencies**  
   `npm install`  
   [VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:88]
3. **Copy the example env file**  
   `cp .env.example .env`  
   [VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:89]
4. **(Optional) Install Python package for analyzer CLI**  
   `pip install -e .`  
   [VERIFIED: README.md:25]

### Configuration

Set the following variables in `.env` (names only, never values):  

- `DATABASE_URL`: PostgreSQL connection string. [VERIFIED: drizzle.config.ts:3]
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key (if using LLM features). [VERIFIED: server/replit_integrations/audio/client.ts:10]
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI API base URL. [VERIFIED: server/replit_integrations/audio/client.ts:11]
- `API_KEY`: Access key for privileged API endpoints. [VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:100]
- `SESSION_SECRET`: Express session integrity. [VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:101]
- `NODE_ENV`: "development" or "production". [VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:102]
- `PORT`: Defaults to 5000. Set to change. [VERIFIED: .replit:14; server/index.ts:92]

### Database Initialization

Run:
- `npm run db:push`  
  (Applies schema to PostgreSQL using Drizzle Kit)  
  [VERIFIED: package.json:11; drizzle.config.ts; replit.md:73]

### Running the Development Server

- `npm run dev`  
  (Starts dev server at [http://localhost:5000](http://localhost:5000), HMR enabled, API and client via single process)  
  [VERIFIED: package.json:7; README.md:44]

### Production Build/Serve

1. `npm run build`  
   (Builds frontend and backend)  
   [VERIFIED: package.json:8; README.md:52]
2. `NODE_ENV=production npm run start`  
   (Starts backend and serves static client, on port `PORT`/5000)  
   [VERIFIED: package.json:9; server/index.ts:92]

### Key API Usage

- Health check:  
  `curl http://localhost:5000/api/health`  
  [VERIFIED: server/routes.ts:15]
- Sync DB schema:  
  `npm run db:push`  
  [VERIFIED: package.json:11]
- Trigger analysis on workspace:  
  `pta analyze --replit -o ./output`  
  [VERIFIED: README.md:56]
- Trigger deterministic analysis (no LLM):  
  `pta analyze --replit --no-llm -o ./output`  
  [VERIFIED: README.md:64]

### Verification & Forensics

- Check schema and tables: `npm run db:push`  
- Verify audit chain:  
  `curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify`  
- Export and verify forensic pack:  
  `npx tsx scripts/export_forensic_pack.ts --output <pack.json>`  
  `npx tsx scripts/verify_forensic_pack.ts <pack.json>`  
  [VERIFIED: HOWTO JSON; scripts/ci-forensic-gate.sh (not shown, see references list)]

### Common Failures

| Symptom             | Cause                      | Fix                                    |
|-------------------- |---------------------       |----------------------------------------|
| 401 Unauthorized    | Wrong/missing API_KEY      | Set correct header, check `.env`       |
| DB connection error | DATABASE_URL unset/bad     | Ensure DB is running, check .env       |
| No server on port   | Not started/port in use    | Confirm `PORT=5000`, check logs        |

[VERIFIED: drizzle.config.ts:3; .replit:10; server/db.ts:7; server/index.ts:92]

---

## 6. **Integration Surface**

- **API**: REST endpoints provided for project submission, analysis, dossier retrieval, health check, and more, all on `/api/` paths. [VERIFIED: server/routes.ts:15–96; shared/routes.ts (structure, INFERRED)]
- **Environment Variables**: Supports config via `.env` for secrets and settings. [VERIFIED: drizzle.config.ts:3; server/db.ts:7; server/replit_integrations/audio/client.ts:10–11]
- **LLM Integrations**: OpenAI via Replit integration, env keys required. [VERIFIED: server/replit_integrations/audio/client.ts:10–11]
- **Replit Integration**: Replit-specific detection for port-binding and env auto-picking. [VERIFIED: .replit:2; server/index.ts:92]
- **No evidence found for outbound webhooks or third-party push integrations.** [UNKNOWN]

---

## 7. **Data & Security Posture**

- **Data Storage**: PostgreSQL, all domain models in `shared/schema.ts`, persisted via Drizzle ORM. [VERIFIED: drizzle.config.ts:10,13; server/storage.ts:1–45]
- **Session Handling**: Uses express-session with connect-pg-simple for persistence (see package.json:53,47). [VERIFIED]
- **Secrets Management**: All keys, DB URLs, and critical config must be in `.env`; code never logs nor exposes values, only variable names. [VERIFIED: drizzle.config.ts:3,12; server/db.ts:7,13; server/replit_integrations/audio/client.ts:10–11; README.md:146]
- **Authentication**: `API_KEY` required in x-api-key header for privileged API endpoints. [VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:100]
- **Code/execution isolation**: Analyzer avoids scanning its own source files. [VERIFIED: README.md:147]
- **Symlink/traversal/binary checks**: Analyzer enforces self-containment and safe text evidence only. [VERIFIED: README.md:142–145]
- **No evidence of built-in CSRF/XSS mitigation in source** (expected via Express default + secure deployment). [INFERRED]

---

## 8. **Operational Reality**

- **To keep running**:
    - Node.js and PostgreSQL processes must be active and accessible.
    - .env must be provisioned with all required variables.
    - Regularly check logs and `/api/health` endpoint for service and DB status.
    - Update packages as dev or security updates occur (`npm update`).
    - When running with LLM features, OpenAI service must be available and keys must be valid.
    - For deployment, scripts/build.ts and .replit define dev/prod patterns; ensure CI/CD, DB backups, and secrets rotation as appropriate.
[VERIFIED: .replit:2,14,16–19; script/build.ts; drizzle.config.ts; package.json:7–9,11]

---

## 9. **Maintainability & Change Risk**

- **Monorepo structure** with shared types reduces drift between frontend, backend, and analysis engine. [VERIFIED: replit.md:13–20; tsconfig.json:18–21]
- **Clearly separated domain boundaries**: All evidence extraction and analysis in Python; DB models and APIs in TypeScript; UI isolated in React. [VERIFIED]
- **Change risk areas**:  
  - Upgrading Drizzle ORM, Postgres, or Node.js major versions. [INFERRED]
  - Analyst scripts (Python) must stay in lock-step with TypeScript models. [VERIFIED: pyproject.toml:20; package.json:49–50]
  - .env variable set misalignment will cause operational breakage. [VERIFIED: drizzle.config.ts:3, server/db.ts:7, .replit:14]
  - LLM API contract or billing drift must be monitored. [INFERRED]
- **Build tooling**: Uses Vite, esbuild, tsx, all must be consistent to avoid breakage. [VERIFIED: vite.config.ts:1, script/build.ts:41, package.json:8,103]

---

## 10. **Replit Execution Profile**

**Run command**  
- `npm run dev` (.replit:2) [VERIFIED]

**Language/runtime**  
- Node.js 20+ [VERIFIED: .replit:1; package.json:7]

**Port binding**  
- Listens on `$PORT` env (default 5000), binds `0.0.0.0` (all interfaces). [VERIFIED: server/index.ts:92,96; .replit:14,10]
- Exposes port 5000 internally, can be remapped externally. [VERIFIED: .replit:10]

**Required secrets**  
- `DATABASE_URL` [drizzle.config.ts:3, server/db.ts:7,13]
- `AI_INTEGRATIONS_OPENAI_API_KEY` [server/replit_integrations/audio/client.ts:10]
- `AI_INTEGRATIONS_OPENAI_BASE_URL` [server/replit_integrations/audio/client.ts:11]
[All VERIFIED]

**External APIs referenced**  
- OpenAI [server/replit_integrations/audio/client.ts:1; server/replit_integrations/audio/routes.ts:3; server/replit_integrations/chat/routes.ts:2; server/replit_integrations/image/routes.ts:2, server/replit_integrations/image/client.ts:2]
[VERIFIED]

**Nix packages required**  
- `.replit` [python, cargo, libiconv, libxcrypt, etc. present]
- Some build packages are declared but most dev/build tools are Node dependencies. [VERIFIED: .replit:7; package.json:99–105]
- `"python312Packages.pytest_7"` for tests (in .replit:7). [VERIFIED]

**Deployment assumptions**  
- Runs with `npm run dev` for development, or `npm run build` and `npm run start` in production (entrypoint: dist/index.cjs).
- Assumes Node.js and PostgreSQL are present and available.
- Binds on all interfaces; expects port in env/5000.
[VERIFIED: .replit:2,16–19; package.json:8–9; server/index.ts:96; drizzle.config.ts:10]

**Observability/logging**  
- JSON logs for requests (server/index.ts:25–56).
- `/api/health` endpoint. [server/routes.ts:15]
[VERIFIED]

**Limitations**
- No evidence found for log viewing/rotation best practices.
- No explicit outbound webhooks/integrations.
- Production deployment (Docker, systemd, etc) instructions incomplete.
- No explicit split-frontend hosting/run guidance found.
[INFERRED, see Unknowns]

---

## 11. **Unknowns / Missing Evidence**

1. **Production deployment instructions outside Replit/`npm run start`**  
   - No Dockerfile entrypoint logic or orchestration, reverse proxy, or systemd sample.
2. **Database initialization beyond Drizzle migration**  
   - No SQL/user bootstrap/init scripts; only Drizzle migrates schema.
3. **Log file path or rotation/viewing instructions**
4. **Standalone frontend hosting/serving guidance**
5. **No outbound webhook/event notification integrations detected**

[See HOWTO JSON “unknowns” list for expanded rationale and evidence requirements.]

---

## 12. **Receipts (Evidence Index)**

- replit.md:3–4,11–20,21–46,55–59,71–74,79–99
- README.md:3,9-23,24–35,42–66,95–146,151–183
- drizzle.config.ts:3,10,12–13
- server/db.ts:7,13
- server/index.ts:25–56,92,96
- server/routes.ts:15,51,59,72,91
- package.json:7–11,49–50,59,97,103
- script/build.ts:38,41,49–54
- .replit:1–2,5,7,10,14,16–19
- HOWTO JSON “evidence” blocks (as receipts for runbook, config, and CLI usage)
- server/replit_integrations/audio/client.ts:10–11
- pyproject.toml:5–13,20
- shared/schema.ts:10
- All explicit “usage_examples” and “verification_steps” from HOWTO JSON
- Others as explicitly cited in context above

---

# End of Dossier

This analysis was assembled strictly from static artifacts. All claims are labeled as VERIFIED (direct code/config citation), INFERRED (structurally implied but not hash-anchored), or UNKNOWN (evidence unavailable/fuzzy).  
Runtime behavior, security, and correctness are out of scope for static analysis.  
For operational deployment, you must consult the codebase for updates and further implementation detail.