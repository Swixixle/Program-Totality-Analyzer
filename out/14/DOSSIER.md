# DOSSIER: Program Totality Analyzer

---

## 1. **Identity of Target System**

**What is it?**

The Program Totality Analyzer (PTA) is an evidence-bound static analysis and forensic tool for software projects. It automatically produces comprehensive technical dossiers—including operator manuals, integration profiles, and risk/unknown enumerations—for any ingestable codebase (local, GitHub URL, or live Replit workspace). It combines:
- A React frontend for user interaction (submitting analysis requests, viewing results),
- A Node.js/Express backend handling API and workflow orchestration,
- A PostgreSQL database for storing state,
- A Python-based CLI tool for codebase analysis and evidence extraction (README.md:3,9–15; replit.md:3–18).

**What it is NOT:**
- Not a real-time monitoring or content moderation platform—no live enforcement or chat moderation (replit.md:55).
- Not a database engine—it requires a working PostgreSQL instance (replit.md:66).
- Not a generic archival/data lake system.
- Not a full deployment framework—instead designed to be deployed behind a reverse proxy or on PaaS (README.md:24).
- Not a WORM (Write Once Read Many) replacement, though supports anchoring/integration.
- Not multi-operator or highly concurrent at enforcement level.

---

## 2. **Purpose & Jobs-to-be-done**

- **Deterministic Project Analysis:** Provide verifiable technical documentation for any codebase, including architecture, runbooks, config, integration, risk, and unknowns (README.md:9–15).
- **Evidence-First Operator Manual:** Generate install/run/config/howto instructions, always backed by file:line+hash citation (target_howto.json, DOSSIER.md) (README.md:11,15).
- **Forensic Export & Audit:** Enable cryptographic proof-pack export and post-hoc verification (including offline) of evidence and audit chains (replit.md:31, README.md:13, DOSSIER.md:31).
- **Regulatory Alignment:** Facilitate operator evidence for regulatory, compliance, product review, or court use cases (replit.md:32).
- **Integration Profiling:** Catalog detected APIs, webhooks, SDKs, secrets, and port/tls/runtime behaviors for platform/ops readiness (README.md:14–15).
- **Operator Reliability:** Bound all inferences by structured evidence—flag unknowns, never hallucinate (README.md:93).

---

## 3. **Capability Map**

| Capability         | Mechanism / Implementation                 | Evidence                |
|--------------------|-------------------------------------------|-------------------------|
| Evidence-cited HowTo | JSON/Markdown manuals with file:line+hash | README.md:9–15, DOSSIER |
| API Surface Analysis | Static scan, zod schema cross-ref, route map | shared/routes.ts, replit.md:43 |
| Secrets/Config Extraction | Pattern scans, .env template, reference detection | drizzle.config.ts:3, .env.example, README.md:11 |
| Database Schema Mapping | Drizzle ORM, Zod/TypeScript, coverage.json | replit.md:67–69 |
| API Key Auth      | All private/write endpoints, header ENF    | docs/dossiers/lantern_program_totality_dossier.md:100 |
| CLI + Web Hybrid  | Python Typer CLI, Node.js orchestrates/scans | README.md:22; replit.md:60–61 |
| Health/Ready/Forensic Verification | Dedicated endpoints/scripts, curl/manual | HOWTO usage_examples, docs/dossiers/lantern_program_totality_dossier.md:128–144, package.json:11 |
| Port Discovery    | Dynamic: env PORT or default 5000 (all interfaces) | server/index.ts:92,96 |
| Forensic Pack Export/Import | TypeScript scripts & CLI           | scripts/export_forensic_pack.ts, scripts/verify_forensic_pack.ts |

---

## 4. **Architecture Snapshot**

- **Frontend:** React 18 + TypeScript (Wouter router, Radix + shadcn/ui, Framer Motion, Tailwind) (replit.md:21–31).
- **Backend:** Node.js 20+, Express 5, Drizzle ORM, Zod validation, Vite middleware (replit.md:39–46; package.json).
- **Python Analyzer:** Typer-based CLI, performs structural/semantic codebase analysis and returns structured evidence (README.md:22–31; replit.md:54–62).
- **Database:** PostgreSQL 14+, schemas defined in shared/zod/TypeScript (replit.md:66–69; drizzle.config.ts).
- **API Contracts:** All APIs use Zod-checked schemas, with routes and schemas shared between client/server (replit.md:43,89).
- **Secrets & Integrations:** OpenAI API for LLM (via env), AI modules available. Authentication via API_KEY (replit.md:101–103; server/replit_integrations/audio/client.ts:10–11).
- **Build Toolchain:** Vite + esbuild, tsx, tailwindcss/postcss (package.json; postcss.config.js; tailwind.config.ts).

---

## 5. **How to Use the Target System**

### **Operator Manual**

#### A. Prerequisites
1. Node.js 20+ and npm (for server/frontend) (.replit:1; replit.md:41).
2. Python 3.11+ (for CLI analyzer; optional unless doing advanced/standalone analysis) (.replit:1; pyproject.toml:5; README.md:34).
3. PostgreSQL 14+ running and accessible (.replit:1; replit.md:66).
4. jq, unzip (for ops/verification scripts) (.replit:7; replit.md:81).
5. TypeScript, tsx, drizzle-kit installed with `npm` for build/dev (package.json:82–103; replit.md:82).

#### B. Installation
1. **Clone the Repository:**  
   `git clone <repo_url>`  
   (docs/dossiers/lantern_program_totality_dossier.md:86)
2. **Install Dependencies:**  
   `npm install`  
   (docs/dossiers/lantern_program_totality_dossier.md:87-88)
3. **Copy Environment Variable Template:**  
   `cp .env.example .env`  
   (docs/dossiers/lantern_program_totality_dossier.md:89)
4. **Edit `.env` and Set Variables:**  
   `nano .env`  
   Set at least: DATABASE_URL, API_KEY, SESSION_SECRET, NODE_ENV, PORT, AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL  
   (docs/dossiers/lantern_program_totality_dossier.md:91-92)

#### C. Database Initialization
- Run:  
  `npm run db:push`  
  (package.json:11)  
  This applies the schema to your PostgreSQL instance.

#### D. Python CLI Tool (Optional)
- Install:  
  `pip install -e .`  
  (README.md:22; pyproject.toml:6)

#### E. Running in Development
1. **Start Dev Server:**  
   `npm run dev`  
   (replit.md:44; .replit:2)
2. **Access Web UI:**  
   Open [http://localhost:5000](http://localhost:5000) in browser.

#### F. Running in Production
1. **Build:**  
   `npm run build`  
   (docs/dossiers/lantern_program_totality_dossier.md:119)
2. **Start Server:**  
   `NODE_ENV=production npm run start`  
   (docs/dossiers/lantern_program_totality_dossier.md:122)

#### G. Example Usage / API Endpoints
- Health check:  
  `curl http://localhost:5000/api/health`
- Readiness:  
  `curl http://localhost:5000/api/ready`
- Verify audit log (API_KEY required):  
  `curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify`
- Export forensic pack:  
  `npx tsx scripts/export_forensic_pack.ts --output <pack.json>`
- Offline verify forensic pack:  
  `npx tsx scripts/verify_forensic_pack.ts <pack.json>`
- Analyze Replit workspace (Python CLI):  
  `pta analyze --replit -o ./output`

#### H. Verification/Smoke Testing
- **Check DB migrations are applied:**  
  `npm run db:push` (package.json:11)
- **Verify Audit Chain:**  
  `curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify`
- **Export/verify forensic pack:**  
  `npx tsx scripts/export_forensic_pack.ts --output <pack.json>`  
  `npx tsx scripts/verify_forensic_pack.ts <pack.json>`
- **Run smoke test:**  
  `bash scripts/smoke_test.sh`

#### I. Common Failures & Fixes

| Symptom              | Cause                      | Fix                               |
|----------------------|---------------------------|-----------------------------------|
| 401 Unauthorized     | Wrong/missing API_KEY      | Set correct `x-api-key`, check .env |
| DB connection errors | Bad DATABASE_URL, offline | Check credentials, DB up/version 14+ |
| Server not running   | Not started, port conflict| Check logs, ensure PORT/free      |
| Tamper not detected  | Bug, verification skipped | Re-export, re-run verification    |

---

## 6. **Integration Surface**

- **APIs:** RESTful JSON API (health/ready, projects CRUD, trigger analysis, fetch dossier/results). See `server/routes.ts`; `/api/health`, `/api/ready`, `/api/projects`, etc. (replit.md:43–51).
- **Auth:** All sensitive/private endpoints require API_KEY via HTTP header (`x-api-key`).
- **Data formats:** All endpoints use JSON; schemas validated with Zod.
- **Export/Import:** Forensic pack (JSON) export/import scripts for offline verification.
- **SDKs:** None officially provided—usage via HTTP API or command-line.
- **Outbound Webhooks:** Unknown—evidence needed: No explicit outbound webhook config or code found.

---

## 7. **Data & Security Posture**

- **Persistent Data:** PostgreSQL (receipts, projects, analysis, audit logs) (drizzle.config.ts:3,12; server/db.ts:13).
- **Schema & Policy:** All requests validated via Zod schemas (replit.md:43,89).
- **Secrets:** All secrets/credentials set only in the `.env` file. Values never logged or rendered (drizzle.config.ts:3, .env.example:10,23).
- **Session Security:** `express-session` with SESSION_SECRET and PostgreSQL-backed store (package.json:51,57).
- **API Key Authorization:** Required for sensitive routes (docs/dossiers/lantern_program_totality_dossier.md:100).
- **Rate Limiting:** In-memory rate limiting per endpoint/client (package.json:61; replit.md:49).
- **Cryptographic Forensics:** SHA-256 hash chaining, Ed25519 signatures on checkpoints; optional anchor to external sources (docs/dossiers/lantern_program_totality_dossier.md:184–186).

---

## 8. **Operational Reality**

- **Start/Stop:**  
  - Dev: `npm run dev`  
  - Prod: `npm run build` + `NODE_ENV=production npm run start` (.replit:2, .replit:18)
- **Port:**  
  - Default 5000, uses `$PORT` env if set. Listens on 0.0.0.0 (all interfaces) (server/index.ts:92,96).
- **Database:**  
  - PostgreSQL 14+ must be up and credentials valid (drizzle.config.ts:3; server/db.ts:7).
- **Secrets Handling:**  
  - Only through `.env`—values not in source, not logged (docs/dossiers/lantern_program_totality_dossier.md:210; SECURITY.md:84).
- **TLS:**  
  - No built-in TLS/SSL—must be deployed behind HTTPS proxy. (README.md:24)
- **Logging:**  
  - Console logs (structured); log file location/analysis unknown—evidence needed.
- **CI/CD:**  
  - Github Actions with build, test, verification, and artifact generation (replit.md:68).
- **No Data Directory:**  
  - No mutable files, all state in the database (docs/dossiers/lantern_program_totality_dossier.md:218–219).

---

## 9. **Maintainability & Change Risk**

- **Type Safety:** Client, server, and shared types enforced via TypeScript and Zod; reduces drift across API/DB (tsconfig.json:2,16–21; replit.md:19).
- **Reproducibility:** Evidence model enables deterministic claim verification; every operator command and config update is cited to source.
- **Change Risks:**
  - Any schema/API change must update Zod schemas and frontend/backend/shared types.
  - Changes to Python CLI analyzer require backward compatibility for archived packs.
  - Build scripts and NPM/Yarn/lockfile changes affect install/runs.
  - Secrets/config key changes must be communicated to all environments.

---

## 10. **Replit Execution Profile**

### Run Command
- Dev: `npm run dev` (.replit:2)
- Production deploy (autoscale): `node ./dist/index.cjs` (.replit:18)
- Build: `npm run build` (.replit:19)

### Language/Runtime
- Node.js 20
- Python 3.11 (for CLI, not for express web server) (.replit:1)
- PostgreSQL 16 (default in Replit, works with 14+)

### Port Binding
- Listens on port from `$PORT` env (defaults to 5000) (server/index.ts:92)
- Binds to `0.0.0.0` (all interfaces) (server/index.ts:96)
- Matching `.replit` ports section: 5000 internally, port 80 external (.replit:9–11)

### Required Secrets
- `DATABASE_URL` (drizzle.config.ts:3,12; server/db.ts:7,13)
- `AI_INTEGRATIONS_OPENAI_API_KEY` (server/replit_integrations/audio/client.ts:10, chat/routes.ts:6, image/client.ts:6)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` (server/replit_integrations/audio/client.ts:11, chat/routes.ts:7, image/client.ts:7)

### External APIs Referenced
- OpenAI API (`openai` Node.js client in code) (server/replit_integrations/audio/client.ts:1, audio/routes.ts:3, chat/routes.ts:2, image/routes.ts:2, image/client.ts:2)

### Nix Packages Required (from .replit)
- nodejs-20
- web
- python-3.11
- postgresql-16
- libxcrypt (for Python/Postgres bindings) (.replit:1,7)

### Deployment Assumptions
- Expects to be run in a Replit "autoscale" environment or similar PaaS with Postgres and secrets present.
- Binds to all interfaces for Replit proxy.
- No Dockerfile; when outside Replit platform, operator must set up Node, Python, Postgres manually.

### Observability/Logging
- Health/ready endpoints present (server/routes.ts, api contract)
- Structured logging to console (server/index.ts:25–34, script/build.ts:38)
- No explicit log file path or interactive access evidence found ("Unknown — evidence needed")

### Limitations / Gaps
- Entrypoint file is resolved from npm run dev/start; directly named TS files (node/tsx) (package.json:7,9)
- No evidence of outbound webhooks or split frontend build/hosting process (unknown)
- No documented key/secrets rotation process (unknown)
- Absence of explicit log inspection/tail file commands (unknown)
- Production deploy methods for non-Replit platforms (e.g., Dockerfile) not found (unknown)

---

## 11. **Unknowns / Missing Evidence**

| What is Missing                                   | Why It Matters                                      | What Evidence Needed                   |
|---------------------------------------------------|-----------------------------------------------------|----------------------------------------|
| Production deployment methods outside Replit      | Needed for Docker/systemd/PM2/non-Replit ops        | Dockerfile, systemd unit, ops doc      |
| Database initialization beyond drizzle-kit        | May impact role/privileges or custom PG config      | SQL DDL/init scripts & role guides     |
| API_KEY / SESSION_SECRET rotation/generation      | Necessary for long-term secops/periodic rotation    | Procedures for secure key rotation     |
| Log viewing/inspection commands/paths             | Troubleshooting needs real log file/operator access | File paths or log inspection samples   |
| Standalone frontend build/hosting commands        | Needed to separate SPA from API in some deployments | Scripts or manual steps for frontend   |
| Outbound webhook/integration points               | SIEM/integration use cases                          | Example config or webhook reference    |

See [HOWTO JSON unknowns](#receipts) for primary evidence.

---

## 12. **Receipts (Evidence Index)**

- .replit:1,2,7,9-14,18,19
- drizzle.config.ts:3,12
- package.json:7,9,11,51,57,61,82-103
- server/index.ts:25–34,92,96
- README.md:3,9–47,59–81,93–95,128–144,167,174–180
- replit.md:3–46,54–69,97–122
- docs/dossiers/lantern_program_totality_dossier.md:86–154,191–198,218–219
- server/routes.ts:11–93
- server/db.ts:7,13
- server/replit_integrations/audio/client.ts:1,10,11
- server/replit_integrations/chat/routes.ts:6,7
- server/replit_integrations/image/client.ts:6,7
- script/build.ts:38
- pyproject.toml:5,6
- HOWTO JSON (entire, for stepwise/evidence mapping)
- .env.example:5,10,13,14,23

---

**End of Dossier.**