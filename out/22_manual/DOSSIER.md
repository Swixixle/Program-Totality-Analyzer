# Program Totality Analyzer — Target System Dossier

---

## 1. **Identity of Target System**

**What it IS:**  
The target is a static-artifact-anchored analysis system ("Program Totality Analyzer") that — when pointed at a software project (GitHub repo, local path, Replit workspace) — produces a comprehensive evidence-cited technical dossier. It is a full-stack web application combining:
- React frontend (for submitting and browsing analyses)
- Express.js backend (REST API)
- PostgreSQL (for analysis and project storage)
- Python analyzer subsystem (run as a CLI for deterministic or LLM-powered analysis)  
(VERIFIED: README.md:3, replit.md:3, replit.md:12–18)

**What it is NOT:**  
- Not a runtime correctness or security certifier: Only analyzes static artifacts, does not execute or monitor the target system at runtime.  
  (VERIFIED: README.md:5, README.md:134)
- Not a deployment or workflow orchestrator: Does not automate cloud or local deployment of target systems outside of Replit local dev/explore.  
  (VERIFIED: README.md:24)
- Not an operating system or database: Relies on Postgres and existing platforms for state.  
  (VERIFIED: README.md:24, replit.md:19)
- Not a compliance, moderation, or multi-operator enforcement tool.  
  (VERIFIED: replit.md:18)

---

## 2. **Purpose & Jobs-to-be-done**

- **Primary purpose**: Deterministically extract all "operator-relevant" information about a software system by parsing its code, configuration, and associated files. This includes:
    - Boot/run steps (install, build, serve)
    - Integration points (API, secrets, env, endpoints)
    - Deployment/port binding logic
    - Readiness and operational gaps
    - Explicitly marking what cannot be determined without runtime/LLM
(VERIFIED: README.md:9–13,18,38,65; replit.md:4,42–43,71–77)

- **Jobs-to-be-done examples**:
    - As a developer/operator, understand how to start and verify a target system without unvetted shell scripts or guesswork.
    - As an auditor, prove certain claims are anchored to code, config, or are UNKNOWN.
    - As a CI pipeline, sanity-check deploy readiness of repos prior to merge.  
(VERIFIED: README.md:13,161,174)

---

## 3. **Capability Map**

| Capability                  | Mechanism / Implementation                    | Status/Evidence              |
|-----------------------------|-----------------------------------------------|------------------------------|
| Evidence-cited runbooks     | Evidence objects in JSON + Markdown           | VERIFIED (README.md:14,162)  |
| Deterministic parsing       | Python/Node extract run/dev/build/config cmds | VERIFIED (README.md:65–71)   |
| Hash-verification of claims | Reference file:line and hash, validate source | VERIFIED (README.md:93–104)  |
| Operational gap scoring     | Readiness computation (0–100)                 | VERIFIED (README.md:74–75)   |
| Marking of unknowns         | All outputs contain UNKNOWN slots/sections    | VERIFIED (README.md:172)     |
| Secrets detection           | Names only, never secret values               | VERIFIED (README.md:146)     |
| LLM-powered context         | Opt-in OpenAI GPT analysis (semantic layer)   | VERIFIED (README.md:85)      |
| Health + readiness endpoint | REST API reports operational status           | VERIFIED (server/routes.ts:15)|
| On/Offline forensic verify  | Forensic pack export/validation via script    | VERIFIED (README.md:142–144) |

---

## 4. **Architecture Snapshot**

- **Frontend:** React 18 SPA with Wouter, React Query, shadcn/ui, Tailwind; built with Vite.  
  (VERIFIED: replit.md:21–31)
- **Backend:** Express 5 on Node.js 20; REST API, static asset serving, Python analyzer child process.  
  (VERIFIED: replit.md:39–53, server/index.ts:1)
- **Database:** PostgreSQL 14+, Drizzle ORM, Zod schemas; managed via `DATABASE_URL`.  
  (VERIFIED: drizzle.config.ts:3, server/db.ts:7, replit.md:63–72)
- **Analyzer:** Python 3.11+ CLI; Typer, openai, rich; LLM optional.  
  (VERIFIED: README.md:37, pyproject.toml:5, replit.md:54–61)
- **Scripts:** TypeScript (build, forensic export/verify), Python (analyzer).  
  (VERIFIED: script/build.ts:1)
- **Integration Surface:** REST API, environment variables, secret management.  
  (VERIFIED: server/routes.ts, README.md:169)

---

## 5. **How to Use the Target System** (Operator Manual)

### A. Prerequisites
1. **Install Node.js (20+) and npm**  
   (VERIFIED: .replit:1)
2. **Install Python (3.11+)**  
   (VERIFIED: .replit:1, pyproject.toml:5)
3. **PostgreSQL 14+ running and accessible**  
   (VERIFIED: .replit:1, drizzle.config.ts:3)
4. **jq, unzip (for ops scripts and forensics)**  
   (VERIFIED: .replit:7)
5. **(Dev) TypeScript toolchain:** tsx, drizzle-kit, etc.  
   (VERIFIED: package.json:103,99)

### B. Installation
1. **Clone the repository:**  
   `git clone <repo-url>`
2. **Install Node dependencies:**  
   `npm install`
3. **Install Python dependencies:**  
   `pip install -e .`  
   (VERIFIED: README.md:25)
4. **Copy .env template and edit:**  
   `cp .env.example .env`  
   `nano .env`  
   Fill in at minimum:
   - `DATABASE_URL`
   - `API_KEY`
   - `SESSION_SECRET`
   - (`AI_INTEGRATIONS_OPENAI_*` for LLM)
   (VERIFIED: drizzle.config.ts:3, server/replit_integrations/audio/client.ts:10, .env.example:13–14)

### C. Database Initialization
- Run:  
  `npm run db:push`  
  Syncs schema to PostgreSQL.  
  (VERIFIED: package.json:11)

### D. Running in Development
- Start development server:  
  `npm run dev`  
  (VERIFIED: .replit:2)
- Visit app in browser:  
  `http://localhost:5000`  
  (VERIFIED: .replit:10, server/index.ts:92–96)

### E. Running in Production
- Build everything:  
  `npm run build`
- Ensure `NODE_ENV=production` is set  
- Start production server:  
  `npm run start`
  (VERIFIED: package.json:8–9)

### F. Key Usage Examples

- Health check:  
  `curl http://localhost:5000/api/health`
- Readiness check:  
  `curl http://localhost:5000/api/ready`
- Forensic:  
  - Export: `npx tsx scripts/export_forensic_pack.ts --output <pack.json>`
  - Verify: `npx tsx scripts/verify_forensic_pack.ts <pack.json>`
- Run deterministic analysis on Replit:  
  `pta analyze --replit --no-llm -o ./output`
- Run LLM-powered analysis:  
  `pta analyze --replit -o ./output`
  (VERIFIED: README.md:56,82)

### G. Verification
- Database migration:  
  `npm run db:push`
- Health endpoint:  
  `curl -i http://localhost:5000/api/health`
- Export/validate forensic pack as above  
  (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:144)

### H. Common Failures

| Symptom              | Likely Cause                       | Fix                                 |
|----------------------|------------------------------------|-------------------------------------|
| 401 Unauthorized     | API_KEY wrong/missing              | Set x-api-key, check .env           | 
| DB connection error  | Database down/bad DATABASE_URL     | Check DB config/health              | 
| Server port in use   | Conflicting process/PORT           | Adjust PORT, ensure not in use      | 
| Tamper undetected    | Bug in script                      | Re-export/confirm verifier used     | 
(VERIFIED: drizzle.config.ts:3, .replit:10)

---

## 6. **Integration Surface**

- **APIs:**  
  - REST endpoints under `/api/`  
    - `/api/projects`: CRUD projects
    - `/api/health` and `/api/ready`
    - `/api/audit/verify` (protected with API_KEY)
  (VERIFIED: server/routes.ts:15,20,25,59)

- **Webhooks:**  
  UNKNOWN — evidence needed: No explicit outbound webhooks or SIEM/alerting integration detected.

- **Environment Variables:**  
  - `DATABASE_URL`, `API_KEY`, `SESSION_SECRET`, `PORT`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
  (VERIFIED: drizzle.config.ts:3, server/replit_integrations/audio/client.ts:10–11)

- **SDKs / Data formats:**  
  - JSON (all API)
  - Forensic pack export: JSON  
  (VERIFIED: README.md:19,28)

---

## 7. **Data & Security Posture**

- **Secrets:**  
  - All critical config inputs are env-based. Names only extracted, never values.  
  (VERIFIED: README.md:146, drizzle.config.ts:3,server/replit_integrations/audio/client.ts:10)
- **Database:**  
  - Uses PostgreSQL. Connects via `DATABASE_URL`.  
  - No custom SQL role/init scripts detected.  
  UNKNOWN — evidence needed: Are there custom DB users beyond default?
- **Session Management:**  
  - Uses express-session and connect-pg-simple for session storage.  
  (VERIFIED: package.json:53,47)
- **Key Rotation:**  
  UNKNOWN — evidence needed: No operator guide for key rotation/generation steps.
- **Encryption:**  
  - No evidence of application-layer encryption for stored data, outside of DB/SaaS.
- **API Auth:**  
  - API_KEY required for protected endpoints (e.g., POST/verify).  
  (VERIFIED: server/routes.ts:132)
- **Static Asset Security:**  
  - Serves from `/dist/public`, fallback to `index.html`.  
  (VERIFIED: server/static.ts:6–17)

---

## 8. **Operational Reality**

- **Required Runtimes/Services:** Node 20+, Python 3.11+, PostgreSQL, OpenAI API for LLM modes.  
  (VERIFIED: .replit:1, README.md:85)
- **Port Bindings:** Binds to 0.0.0.0, PORT env (default 5000, can be overridden).  
  (VERIFIED: server/index.ts:92–96)
- **Database Maintenance:** Running migrations requires npm/Drizzle.  
  (VERIFIED: package.json:11)
- **Log/Observability:** Console.log by default; no log files or log rotation path evidenced.  
  UNKNOWN — evidence needed: Log file destinations or rotation procedures.
- **Health Infrastructure:** Provides `/api/health`, `/api/ready` endpoints.
  (VERIFIED: server/routes.ts:15)
- **Static Hosting:** In production, static assets served from `dist/public`.  
  (VERIFIED: server/static.ts:13)

---

## 9. **Maintainability & Change Risk**

- **Monorepo; strict separation of client/server/shared.** (VERIFIED: replit.md:12–17)
- **Type safety:** Zod, shared TS types between frontend/backend.  
  (VERIFIED: replit.md:17,72)
- **Lockdown on ambiguous claims:** All outputs must be EVIDENCED, INFERRED, or UNKNOWN.
- **Deterministic mode:** Re-running analysis with same artifacts should produce same output in deterministic (`--no-llm`).  
  (VERIFIED: README.md:60–65)
- **Dependencies:** Regular npm and Python dependency maintenance needed (see package.json, pyproject.toml).  
  (VERIFIED: package.json, pyproject.toml)
- **Change risk:** Any change to scripts, run commands, or env var names will break operator workflows.  
  (INFERRED: monorepo structure; "paths" in tsconfig.json:19–21, scripts parsing package.json for commands)

---

## 10. **Replit Execution Profile**

### Run Command
- `npm run dev`
  (VERIFIED: .replit:2)

### Language/Runtime
- Node.js 20; TypeScript project; Python 3.11+ for analyzer CLI.
  (VERIFIED: .replit:1, pyproject.toml:5)

### Port Binding
- Listens on `0.0.0.0:${PORT}`; defaults to 5000.
  - (VERIFIED: server/index.ts:92–96, .replit:10, .replit:14)
- Replit points external port 80 to local 5000.
  - (VERIFIED: .replit:10)

### Required Secrets
- `DATABASE_URL` (drizzle.config.ts:3, server/db.ts:7)
- `AI_INTEGRATIONS_OPENAI_API_KEY` (server/replit_integrations/audio/client.ts:10)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` (server/replit_integrations/audio/client.ts:11)

### External APIs Referenced
- **OpenAI** (used by LLM analyzer, audio, chat, image integrations)
  - (VERIFIED: server/replit_integrations/audio/client.ts:1, server/replit_integrations/audio/routes.ts:3, server/replit_integrations/chat/routes.ts:2, server/replit_integrations/image/routes.ts:2)

### Nix Packages Required (Replit)
- `cargo`, `libiconv`, `libxcrypt`, `python312Packages.pytest_7`, `rustc`
  (VERIFIED: .replit:7)
- (INFERRED: some listed for forensic-pack validation or dev tooling rather than Node app itself)

### Deployment Assumptions
- App expects a single server binding for API + SPA on one port. (VERIFIED: server/index.ts:91–92)
- No evidence of reverse proxy or orchestrator config provided. Dockerfile present (see limits).

### Observability/Logging
- Console logging, request/response logging for API; no evidence of persistent structured logs or log files.  
  (VERIFIED: server/index.ts:25–34)
- `/api/health` endpoint.  
  (VERIFIED: server/routes.ts:15)
- No explicit metrics or alerting integration.
  (UNKNOWN — evidence needed)

### Limitations  
- No evidence for explicit log file destinations or log rotation.
- No evidence for production deployment outside Replit (see Dockerfile, but no compose/K8s/systemd detected).
- No docs on key rotation or SIEM/alerting/outbound webhooks.
- Replit-specific files present, but standalone hosting instructions or CDN configuration for client are missing.

---

## 11. **Unknowns / Missing Evidence**

| What is Missing                         | Why It Matters                                             | Evidence Needed                                              |
|------------------------------------------|------------------------------------------------------------|-------------------------------------------------------------|
| Production deployment (non-Replit) config| Clarity on cloud ops, best practice, reverse proxy         | Compose/K8s/Dockerfile (partial), systemd, nginx files      |
| Custom Postgres role/init scripts        | Security/privilege hygiene in DB layer                     | SQL init scripts, DB user/role docs                         |
| Log file locations and rotation          | Operator troubleshooting, compliance                       | Log path refs, logrotate config, log viewer docs            |
| Standalone frontend build/hosting        | Split UI hosting (static/CDN) scenarios                    | Frontend prod build/run docs, client-only server scripts     |
| Outbound webhooks/SIEM/alerting          | Security/monitoring integration                            | Webhook config/docs, alerting shell/URL patterns            |
| Key rotation/generation runbooks         | Security hygiene/ops                                       | Operator docs/scripts for rotating API_KEY, SESSION_SECRET  |

---

## 12. **Receipts** (Evidence Index)

This section lists all explicit source evidence by file:line.

- .replit:1,2,5,7,10,14
- drizzle.config.ts:3,12
- pyproject.toml:5
- README.md:3,5,9,13-14,18,24,25,28,38,47,56,65,73–75,85,93–104,134,146,162
- replit.md:3,4,12–18,19,21–31,39–53,54–61,63–72
- package.json:8–9,11,47,53,103,99
- server/index.ts:1,25–34,92–96
- server/db.ts:7
- server/replit_integrations/audio/client.ts:10–11
- server/routes.ts:15,20,25,59,132
- server/static.ts:13
- script/build.ts:1,38
- .env.example:13–14
- shared/schema.ts:10
- package.json (entire)
- tsconfig.json:19–21
- Dockerfile (partial evidence for potential deployment)
- (And referenced documentation lines above in the markdown)

---

# End of Dossier

**Scope limitation reminder:** This dossier is based on _static artifacts only_. Execution correctness, real runtime security, and cloud/infrastructure integration state are not certified. All unknowns are explicitly listed above.