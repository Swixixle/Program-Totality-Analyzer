# DOSSIER: Program Totality Analyzer (PTA)

---

## 1. **Identity of Target System**

**What it IS:**  
A full-stack web application (monorepo) for evidence-bound, static analysis of software projects ("Program Totality Analyzer"). Provides a technical dossier that extracts what a target system is, how it works, how to operate it, and what cannot be known — all with every operational claim anchored to file:line+hash evidence. Includes:
- Express+Node.js backend API service
- PostgreSQL database (operational/project state)
- React frontend for submitting analysis and browsing dossier results
- Python-based analyzer (spawned CLI) for deterministic and LLM-augmented static analysis  
(VERIFIED: README.md:3,9; replit.md:3,4,11–18,41–42,54–55)

**What it is NOT:**  
- NOT a runtime validator, real-time monitor, or correctness/security proof system (VERIFIED: README.md:5,134, replit.md:5)
- NOT a database engine (uses PostgreSQL, no embedded DB) (VERIFIED: replit.md:63)
- NOT a deployment/orchestration framework (does not include Docker/systemd config for non-Replit; UNKNOWN for advanced deployment support — see Unknowns)
- NOT a multi-tenant enforcement or moderating system  
(VERIFIED: replit.md:18–19,22)

---

## 2. **Purpose & Jobs-to-be-done**

- Deterministic extraction of operational runbook, config, integration details for software target systems (VERIFIED: README.md:7–21)
- Produce forensic, evidence-cited coverage for operators, auditors, and developers (VERIFIED: README.md:7–13; replit.md:98)
- Support post-hoc analysis, gap detection, risk auditing, and reproducible proof packs (VERIFIED: README.md:20–21,149–161)
- Detect operational unknowns and flag unverifiable claims (VERIFIED: README.md:174; replit.md:98)

---

## 3. **Capability Map**

| Capability                          | Mechanism / Implementation                          | Evidence                 | Status    |
|--------------------------------------|-----------------------------------------------------|--------------------------|-----------|
| Evidence-bound operator dashboard    | `operate.json`, runbooks, config, port, API claims  | README.md:13,151–161     | VERIFIED  |
| Three analysis modes (github/local/replit) | CLI options, server routes                          | README.md:56–58, replit.md:56–59 | VERIFIED  |
| Static artifact parsing & indexing   | Structural analyzer layer (Python, deterministic)   | README.md:151–161        | VERIFIED  |
| LLM semantic analysis (optional)     | OpenAI API (Replit-provided)                        | README.md:67,84, replit.md:66 | VERIFIED  |
| Health/readiness probe endpoints     | `/api/health`, `/api/ready`                         | server/routes.ts:15–16; replit.md:55 | VERIFIED  |
| Forensic pack export/verification    | TypeScript ops scripts, JSON export/verify pack     | scripts/export_forensic_pack.ts, scripts/verify_forensic_pack.ts | VERIFIED  |
| SHA-256 snippet hashing of evidence  | Structural snippet-hash verification model          | README.md:109–110,132    | VERIFIED  |
| Gap scoring and operational coverage | Readiness, gaps, unknown detection in outputs       | README.md:162,174        | VERIFIED  |
| No secret value extraction           | Only env variable NAMES extracted, never values     | README.md:146            | VERIFIED  |

---

## 4. **Architecture Snapshot**

- **Frontend:** React 18 + Vite + Tailwind + shadcn/ui, uses TanStack React Query and Wouter for routing/data-fetch. (VERIFIED: replit.md:15–22)
- **Backend:** Node.js 20, Express 5 REST API, Vite-middleware (dev), static file serving (prod), Drizzle ORM for database (VERIFIED: replit.md:41–42,44)
- **Analyzer:** Python 3.11+, Typer-based CLI, spawn model, deterministic core + LLM integration (VERIFIED: replit.md:56–66)
- **Database:** PostgreSQL 14+, schema and migrations via Drizzle Kit (VERIFIED: drizzle.config.ts:3,9,63)
- **Shared Types:** Monorepo zone `shared/` for schemas and Zod validation (VERIFIED: replit.md:17–19,72)
- **Key Integrations:** OpenAI API for LLM (Replit-native), enforced through environment variables (VERIFIED: server/replit_integrations/audio/client.ts:10–11)
- **Observability:** JSON logging, health-check endpoints (VERIFIED: server/routes.ts:15, server/index.ts:25–56)

---

## 5. **How to Use the Target System**

### **Operator Manual**

#### **A. Prerequisites**
1. Node.js 20+ and npm (verify with `node -v` and `npm -v`) (VERIFIED: replit.md:79)
2. Python 3.11+ (VERIFIED: replit.md:81)
3. PostgreSQL 14+ running and accessible (VERIFIED: drizzle.config.ts:3, replit.md:80)
4. Install `jq`, `unzip` if using forensic export/ops scripts (VERIFIED: replit.md:81)
5. TypeScript, `tsx`, `drizzle-kit` for build/dev (devDependencies) (VERIFIED: package.json:82–106)

#### **B. Installation**
1. Clone the repository (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:86)
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
   (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:88)
3. Copy environment config template:
   ```bash
   cp .env.example .env
   ```
   (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:89)
4. Edit `.env` and fill in required environment variables:
   - `DATABASE_URL`, `API_KEY`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:91)
5. (If running analyzer/offline ops scripts): Install Python dependencies:
   ```bash
   pip install -e .
   ```
   (VERIFIED: README.md:25)

#### **C. Configuration**
Set required environment variables in `.env` (NAMES only, never values):
- `DATABASE_URL`: PostgreSQL connection string (VERIFIED: drizzle.config.ts:3)
- `API_KEY`: Protects private/protected endpoints (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:100)
- `SESSION_SECRET`: Session signature (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:101)
- `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL`: For LLM-powered analysis (VERIFIED: server/replit_integrations/audio/client.ts:10–11)
- `PORT`: Server port, defaults to 5000 (VERIFIED: .replit:14)

#### **D. Database Initialization**
Initialize/migrate schema:
```bash
npm run db:push
```
(VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:108)

#### **E. Development Server**
Start local dev server with backend API and frontend (via Vite middleware):
```bash
npm run dev
```
(VERIFIED: .replit:2)

#### **F. Production Build & Start**
1. Build for production:
   ```bash
   npm run build
   ```
   (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:119)
2. Start production server:
   ```bash
   npm run start
   ```
   (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:122)

#### **G. Usage Examples**
- Health check:
  ```bash
  curl http://localhost:5000/api/health
  ```
- Readiness check:
  ```bash
  curl http://localhost:5000/api/ready
  ```
- Verify audit log integrity:
  ```bash
  curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify
  ```
- Export a forensic pack:
  ```bash
  npx tsx scripts/export_forensic_pack.ts --output <pack.json>
  ```
- Offline verify a forensic pack:
  ```bash
  npx tsx scripts/verify_forensic_pack.ts <pack.json>
  ```

(Commands cited from usage_examples in HOWTO JSON)

#### **H. Verification Steps**
- Initialize database schema:  
  `npm run db:push` (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:108)
- Verify health endpoint:
  `curl http://localhost:5000/api/health` (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:128)
- Verify audit chain:
  `curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify` (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:140)

#### **I. Common Failures**
| Symptom               | Cause                     | Fix                                  |
|-----------------------|--------------------------|--------------------------------------|
| 401 Unauthorized      | Wrong/missing API_KEY    | Set correct x-api-key, check .env    |
| DB connection errors  | Bad DATABASE_URL, DB down| Check credentials/service/version    |
| Server not running    | App not started/port clash| Check logs, set PORT=5000, check use |
| Forensic pack tamper undetected | Script not installed or bug | Re-export, ensure proper script     |
(VERIFIED: listed in HOWTO/common_failures)

---

## 6. **Integration Surface**

- REST API at `/api/*` (project/analysis orchestration, health, readiness, audit proof, etc.) (VERIFIED: server/routes.ts:20–51)
- Uses HTTP header `x-api-key` for private/protected endpoints (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:100)
- OpenAI (LLM integration via server-side Replit integration modules) (VERIFIED: server/replit_integrations/audio/client.ts:10–11)
- Forensic pack import/export via TypeScript scripts (see `scripts/export_forensic_pack.ts` etc.)
- Data formats: JSON for API and forensic packs; Markdown for dossier output  
(VERIFIED: README.md:18,151–161; server/routes.ts:91)

---

## 7. **Data & Security Posture**

- **Primary storage:** PostgreSQL, connection string via `DATABASE_URL`, Drizzle ORM (VERIFIED: drizzle.config.ts:3–13; server/db.ts:13)
- **Session Handling:** express-session, session secret required, can persist to DB (VERIFIED: package.json:53,47)
- **Authentication:**  
  - API_KEY checked for protected endpoints (header `x-api-key`) (VERIFIED: docs/dossiers/lantern_program_totality_dossier.md:100, server/routes.ts)
  - No evidence of OAuth or RBAC in static scan (UNKNOWN: advanced role management)
- **Secret Handling:** Environment variables required for DB, API, OpenAI keys; values never checked into source (VERIFIED: drizzle.config.ts:3; server/replit_integrations/audio/client.ts:10–11)
- **Encryption:** No explicit crypt at rest, relies on DB/PaaS. SSL/TLS for OpenAI is assumed but not evidenced directly in code (INFERRED)
- **Forensic Proof:** SHA-256 hashes on all cited evidence references for operator verification. (VERIFIED: README.md:109–110,132)
- **Secret Safety:** Only env variable NAMES are extracted by static analyzer, never values. (VERIFIED: README.md:146)
- **API Rate Limiting:** Used for preventing abuse (VERIFIED: server/storage.ts: package.json:61) 

---

## 8. **Operational Reality**

- **To keep running:**
  - Node.js 20+, npm
  - Python 3.11+ (if using analyzer or running scripts/analyzing targets)
  - PostgreSQL 14+ up and reachable at `DATABASE_URL`
  - All required env vars set: most notably `DATABASE_URL`, `API_KEY`, `SESSION_SECRET`, OpenAI keys (if LLM features needed)
  - Periodic schema migration with `npm run db:push` as updates are pulled
  - Monitor logs via stdout/stderr (VERIFIED: server/index.ts:25–56, server/routes.ts:15)
  - Bind/serve on externally accessible port (default 5000), firewall others (VERIFIED: server/index.ts:96)
- **Build process:** `npm run build` (Vite for client, esbuild for backend) (VERIFIED: package.json:8; script/build.ts:41,40)
- **Health checks:** `/api/health` and `/api/ready` (VERIFIED: server/routes.ts:15; server/routes.ts:16)
- **No explicit log file rotation or central collection detected (UNKNOWN; see Unknowns below)**

---

## 9. **Maintainability & Change Risk**

- Changes to shared types/interfaces are monorepo-wide and must be propagated through both server and client (VERIFIED: replit.md:17–19)
- TypeScript type drift risk is minimized by single shared schema (VERIFIED: replit.md:19,94)
- Backend (Node.js/Express/TypeScript) and Analyzer (Python 3.11+) must both be maintained, increasing upgrade/test matrix (VERIFIED: replit.md:95–96)
- Schema migrations required for new DB features; uses Drizzle Kit (VERIFIED: drizzle.config.ts:9–10)
- Adding more API integrations or auth mechanisms would require new secret/environment management
- No automated DB/data backup observed (UNKNOWN)
- No explicit central logging or error tracking configured (UNKNOWN)
- No evidence of CI/CD pipeline files. Build is scriptable via package.json/scripts (VERIFIED: package.json:8–10)

---

## 10. **Replit Execution Profile**

### **Run Command**
- `npm run dev` (VERIFIED: .replit:2)

### **Language/Runtime**
- Node.js 20+ (VERIFIED: .replit:1, package.json:2)

### **Port Binding**
- Binds to port defined in `PORT` env (default 5000), listens on `0.0.0.0` (all interfaces) (VERIFIED: server/index.ts:92,96)
- `.replit` config sets port 5000 (VERIFIED: .replit:14)
- Port is exposed and waited on in workflow for startup (VERIFIED: .replit:40–41)

### **Required Secrets**
- `DATABASE_URL`: required for database (VERIFIED: drizzle.config.ts:3, server/db.ts:7,13)
- `AI_INTEGRATIONS_OPENAI_API_KEY`: for OpenAI API (VERIFIED: server/replit_integrations/audio/client.ts:10)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: for OpenAI API (VERIFIED: server/replit_integrations/audio/client.ts:11)

### **External APIs Referenced**
- OpenAI API (LLM/AI integration for analyzer features) (VERIFIED: server/replit_integrations/audio/client.ts:1,10–11)
- No evidence of additional external APIs in static analysis

### **Nix Packages Required** (from .replit)
- `cargo`, `libiconv`, `libxcrypt`, `python312Packages.pytest_7`, `rustc` (VERIFIED: .replit:7)
- For this project's actual dev use: only `python3`, Node.js, PostgreSQL exposed via Replit modules

### **Deployment Assumptions**
- Runs in Replit's autoscale environment (VERIFIED: .replit:17)
- Must bind to `0.0.0.0` on `PORT` (firewall enforced) (VERIFIED: server/index.ts:96)
- Needs PostgreSQL service accessible at configured host/port
- Requires all listed env vars set in deployment environment

### **Observability/Logging**
- Health probes: `/api/health` in dev & prod (VERIFIED: server/routes.ts:15)
- Logs requests/responses to stdout (console) (VERIFIED: server/index.ts:25–56)
- No file-based log rotation configured (UNKNOWN; see Unknowns)
- No evidence of error reporting to external observability/SIEM systems

### **Limitations**
- No containerization or external production deployment files detected (UNKNOWN)
- Persistent log file path/rotation mechanism not found (UNKNOWN)
- Webhooks/outbound event integration not found (UNKNOWN)

---

## 11. **Unknowns / Missing Evidence**

- **Production Deployment Details:** No Docker Compose, systemd, or reverse proxy config found for bare-metal or non-Replit deployment (UNKNOWN — evidence needed: docker-compose, prod hosting guides, etc.)
- **Database Roles/Privilege Init:** No explicit DB user roles/privs bootstrap scripts or guides found (UNKNOWN — evidence needed: SQL/DB bootstrap documentation)
- **Key Rotation:** No operator procedure for rotating `API_KEY` or `SESSION_SECRET` (UNKNOWN — evidence needed: rotation/how-to guide)
- **Log File Path/Viewing:** No persistent log file reference or log tail/collect commands found (UNKNOWN — evidence needed: file path, log viewing instructions)
- **Frontend-only Deployment:** No standalone static hosting details or split-frontend commands found (UNKNOWN — evidence needed: static hosting doc)
- **Outbound Webhooks:** No webhook/event integration found in source (UNKNOWN — evidence needed: webhook/event config or code presence)
- **Automated Backup/CI:** No evidence of automated database or evidence pack backup jobs, or full CI/CD pipeline (UNKNOWN — evidence needed: CI/CD config, backup scripts)
- **Advanced Auth Models:** No RBAC, SSO/OAuth, or multi-user role management detected (INFERRED — not present in static API schema)

---

## 12. **Receipts (Evidence Index)**

Below is a non-exhaustive list of key evidence locations cited above. For complete traceability, see all evidence indexes and JSON output:

- README.md:3,5,7–21,23–25,29,39,44,47,151–161,174
- replit.md:3,4,11–24,41–46,54–66,79–100
- drizzle.config.ts:3,9–13
- package.json:8–10,11,14–115,82–106
- .replit:2,5,7,14,17,40–41
- server/index.ts:25–56,92,96
- server/routes.ts:15,20–51,91
- server/db.ts:7,13
- server/replit_integrations/audio/client.ts:10–11
- script/build.ts:38,40,41
- docs/dossiers/lantern_program_totality_dossier.md:86,88,89,91,100,101,108,119,122,128,140
- scripts/export_forensic_pack.ts, scripts/verify_forensic_pack.ts
- shared/schema.ts:10

For UNKNOWNs, see section 11 for explicit "evidence needed" descriptors.  

---

**This dossier is evidence-bound to the codebase and its configuration, not to runtime or external artifacts. All findings are subject to the scope of static analysis only.**