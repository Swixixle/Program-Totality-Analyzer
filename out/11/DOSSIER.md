# Lantern Program Totality Dossier

## 1. Identity of Target System

### What it IS

- **Lantern** is an evidentiary record system for investigative analysis. It enables structured extraction from unstructured text, manual curation of dossiers, bounded heuristics analysis, and tamper-evident reporting designed for legal and journalistic workflows (LANTERN_SYSTEM_SNAPSHOT.md:line10, LANTERN_CORE_BOUNDARY.md:line4).

### What it is NOT

- **Not generative or predictive**: Does not invent, forecast, recommend, or issue verdicts (LANTERN_SYSTEM_SNAPSHOT.md:line16-20).
- **Not autonomous**: Human review and curation are required at every analysis stage. No AI fact generation. (LANTERN_SYSTEM_SNAPSHOT.md:line20).
- **Not networked/persistent (by default)**: All actual "records" exist in browser localStorage, not on a server or global backend, unless future backend persistence is explicitly enabled (AUDIT_REPORT.md:line56).

---

## 2. Purpose & Jobs-to-be-done

- **Primary Purpose**: To transform unstructured documentary evidence into structured, provenance-enforced analytical dossiers, explicitly bounded by human review and epistemic controls (LANTERN_SYSTEM_SNAPSHOT.md:line10, line50-57).
- **Core Jobs**:
  1. **Text Extraction**: Extract entities, quotes, timeline events, and metrics from input text (LANTERN_SYSTEM_SNAPSHOT.md:line51).
  2. **Curation**: Structure, merge, or correct extracted packs into curated dossiers. All edits are tracked, and schema upgrades are migration-logged (LANTERN_SYSTEM_SNAPSHOT.md:line53-54, line92-95).
  3. **Heuristic Analysis**: Analyze graphs for influence, funding, enforcement patterns, with explicit sufficiency thresholds (LANTERN_SYSTEM_SNAPSHOT.md:line62-81).
  4. **Reporting**: Produce exportable, point-in-time audit records with SHA-256 fingerprints and migration histories (LANTERN_SYSTEM_SNAPSHOT.md:line114-127).
  5. **Comparison**: Structure-alignment and comparison of two dossiers (LANTERN_SYSTEM_SNAPSHOT.md:line67, line116-118).

---

## 3. Capability Map

| Capability        | Status           | Evidence                                      |
|-------------------|------------------|-----------------------------------------------|
| Local Text Extraction | Implemented (Deterministic) | LANTERN_CORE_BOUNDARY.md:line10-23|
| Dossier Curation | Implemented      | LANTERN_SYSTEM_SNAPSHOT.md:line53-54 |
| Heuristic Graph Analysis | Implemented | LANTERN_SYSTEM_SNAPSHOT.md:line60-82 |
| Provenance Tracking | Strict         | LANTERN_CORE_BOUNDARY.md:line38-47 |
| Tamper-Evident Reporting | Implemented | LANTERN_SYSTEM_SNAPSHOT.md:line110-127 |
| Local Storage (Browser) | Production in Prototyping | AUDIT_REPORT.md:line56 |
| API Backend/Server | Placeholder Only | AUDIT_REPORT.md:line42-43 |
| Backend DB (Postgres/Drizzle) | Scaffolded, Not Wired | AUDIT_REPORT.md:line42-43 |
| Migration (Schema) | Implemented     | BOOK_OF_FIXES.md:line121-132 |
| Human-in-the-loop Curation | Required | LANTERN_SYSTEM_SNAPSHOT.md:line10, line53 |
| Export (Markdown) | Implemented      | LANTERN_SYSTEM_SNAPSHOT.md:line39 |
| End-to-End Tests  | Unknown — evidence needed: Test directory, command, or documentation describing for e2e/UI/acceptance tests |

---

## 4. Architecture Snapshot

- **Client-heavy, hybrid stack**: All essential logic (extraction, heuristic analysis, curation) runs client-side. (AUDIT_REPORT.md:line36-41)
- **Backend/Server**: Present but acts as static file host and placeholder for future API development. No live API endpoints implemented. (AUDIT_REPORT.md:line42-43)
- **Data**: All meaningful packs saved only in browser localStorage ("lantern_packs" key), lost on cache clear. (AUDIT_REPORT.md:line56)
- **Migration Layer**: On-load, old pack schemas are migrated, tracked in logs. (BOOK_OF_FIXES.md:line122-132)
- **No network calls**: No `fetch`/`axios` in extraction flow, except for config and demo keys. (AUDIT_REPORT.md:line47)

---

### Replit Execution Profile

- **Languages/Stacks enabled**: Node.js 20, Web, PostgreSQL 16 (.replit:line1)
- **Default Port**: 5000 (local), mapped to external 80 (.replit:line10-11)
- **Development server**: `npm run dev` (runs both Express and Vite) (.replit:line2, package.json:line8)
- **Deployment**: Production build+run via `npm run build` ➔ `node ./dist/index.cjs` (.replit:line22-23)

---

## 5. How to Use the Target System

### Prerequisites

- **Node.js 16+ (or 20+)** (.replit:line1, .github/workflows/ci.yml:line20)
- **npm (or yarn)** (.replit:line1, README.md:line27)
- **[Optional] PostgreSQL 16** for backend DB development (.replit:line1)
- **Modern browser** for client usage

---

### Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/Swixixle/Lantern.git
   ```
   Evidence: README.md:line31

2. **Change directory to the project folder**
   ```sh
   cd Lantern
   ```
   Evidence: README.md:line32

3. **Install JavaScript dependencies**
   ```sh
   npm install
   ```
   Evidence: README.md:line33

---

### Configuration

- **No required configuration for default (local-storage only) operation.**
- Optional environment variables:
  - `PORT`: Sets server port (defaults to 5000) (.replit:line18)
  - `DATABASE_URL`: Needed *only* for backend/postgres work and pack migrations with Drizzle ORM (drizzle.config.ts:line3)
  - UI config at `/api/config`: Controls `public_readonly` mode, influences read-only status (client/src/lib/config.tsx:line4)

---

### Running (Development)

- **Full Stack Dev Server** (Vite UI + Express API/Static):
  ```sh
  npm run dev
  ```
  Evidence: README.md:line40, package.json:line8

- **Client Only (Vite UI for prototyping):**
  ```sh
  npm run dev:client
  ```
  Evidence: AUDIT_REPORT.md:line30, package.json:line7

---

### Running (Production)

1. **Build:**
   ```sh
   npm run build
   ```
   Evidence: README.md:line57, package.json:line9

2. **Start:**
   ```sh
   npm start
   ```
   Evidence: README.md:line58, package.json:line10

---

### Access and Usage

- **Access the application** in your browser at:  
  [http://localhost:5000](http://localhost:5000)  
  Evidence: README.md:line43

- **Example Workflow:**
  - Use the "Extract" view to input raw text and generate an Extract Pack.
  - Review and promote extracted items to a Dossier Pack in the Library.
  - Edit, add, remove or migrate data as required.
  - Navigate to "Report" to apply heuristic analysis and view/export reports.
  - Use "Compare" to align two dossiers structurally.

---

### Verifying Installation

- **Run Build to verify compilation:**
  ```sh
  npm run build
  ```
  Evidence: BOOK_OF_FIXES.md:line32, CHANGELOG.md:line103

- **Check unit tests:**  
  ```sh
  npx vitest run client/src/lib/tests/unit/
  ```
  Evidence: M2_SUMMARY.md:line62

- **Manual UI Verification:**  
  - After starting server, open [http://localhost:5000](http://localhost:5000) in a browser and verify the UI loads and all navigation is available (README.md:line43).
  - Optionally, verify "Engine Stats" panel in UI after extract to confirm provenance/dedupe (attached_assets... .txt:line115).

---

### Common Failure Modes & Remedies

| Symptom | Usual Cause | Remedy | Evidence |
|---------|-------------|--------|----------|
| **App does not load ("white screen")** | Frontend code error or build failure | Check browser console, run `npm run build`, review recent code changes | README.md:line82, BOOK_OF_FIXES.md:line11 |
| **EADDRINUSE error** | Port 5000 already used | Stop all running workflows, wait 5 seconds, restart | README.md:line90 |
| **Data loss (packs disappear)** | Browser cache/localStorage cleared | Regularly export packs as JSON; cannot recover lost data | AUDIT_REPORT.md:line70 |
| **App fails type checking/build** | Source/type mismatch | Fix type errors, re-run `npm run build` | BOOK_OF_FIXES.md:line12 |

---

### Troubleshooting

- If a build fails due to `"import" and "export" may only appear at top level` or similar errors, check for duplicate import/exports. (BOOK_OF_FIXES.md:line12)
- If previously saved extracts/dossiers are missing, confirm localStorage wasn't cleared. (AUDIT_REPORT.md:line70)
- For "Port already in use" errors, kill any hanging Node.js/Vite processes and restart. (README.md:line90)

---

## 6. Integration Surface

### APIs

- **No operational API endpoints**. `server/routes.ts` is a placeholder; no user/dossier/data management routes exposed for programmatic integration. (AUDIT_REPORT.md:line22, line40)
- **Public client config API:** `/api/config` returns `{ public_readonly: boolean }` (client/src/lib/config.tsx:line19)

### Data Import/Export

- **Export Format:** Markdown with YAML frontmatter for reports; dossier and extract packs as JSON (LANTERN_SYSTEM_SNAPSHOT.md:line39, line56)
- **Pack schemas:** Extract Packs ("lantern.extract.pack.v1") and Dossier Packs (schemaVersion 2, presence of packId) (LANTERN_SYSTEM_SNAPSHOT.md:line27, line32)
- **Pack Migration:** Handled automatically in the UI/storage layer during load (BOOK_OF_FIXES.md:line124-127)

### CLI/Other Integration

- **Standalone bundle verifier**: See `tools/verifier_package.json` for verifying exported bundles (tools/verifier_package.json:line2)

---

## 7. Data & Security Posture

### Storage

- **Client-Side Only (default):**
  - **LocalStorage** under `"lantern_packs"` key (AUDIT_REPORT.md:line56).
  - **Volatile:** Cleared if browser cache is cleared. No server backup. (AUDIT_REPORT.md:line70)

- **Planned/Optional (not default):**
  - **Backend Drizzle/Postgres adapter:** Scaffold present but **not wired to any client or production workflow**. (AUDIT_REPORT.md:line42-43, drizzle.config.ts:line3)

### Encryption

- **No encryption at rest**: All data in browser localStorage, not encrypted (AUDIT_REPORT.md:line56, LANTERN_SYSTEM_SNAPSHOT.md:line56).
- **No TLS enforcement baked-in**: Default usage is `http://localhost`.

### Authentication

- **API Key authentication**: Operator user can enter API key manually in UI; "Demo Login" fetches key via `/api/auth/demo-key` (client/src/App.tsx:line56).  
  **Note:** Server does not enforce or utilize these keys for any persistence due to inactive backend.

- **Read-only Mode:** Controlled by `/api/config` endpoint, sets UI into review/read-only mode (client/src/lib/config.tsx:line4).

### Handling of Secrets

- **DATABASE_URL**: Required *only* for advanced server/ORM/migration work, not for the default (client-only) setup (drizzle.config.ts:line3); value should be provided via environment variable.
- **No other application-level secrets referenced or used** (AUDIT_REPORT.md:line48).

---

## 8. Operational Reality

### Day-to-day Operation

- **No database infrastructure needed for default usage**.
- **Operator must educate users** that all data is local and volatile (AUDIT_REPORT.md:line70).
- **For backend use:** Explicit DB provisioning and environment setup required (DATABASE_URL); migration and schema upgrade process **not operationalized** (drizzle.config.ts:line3).
- **Server-side ops:** No documented process for Postgres deployment/running in production. (Unknown)

### Maintenance

- **Manual intervention** required for major upgrades, migration, or recovery.
- **Schema upgrades**: Auto-migrated in client, migration logs appended (BOOK_OF_FIXES.md:line124-127).
- **Data Loss**: No automated backup/recovery.
- **No deployed monitoring, alerting, or CI status surfaced.** (AUDIT_REPORT.md:line49)

---

## 9. Maintainability & Change Risk

- **Codebase is modular and type-checked**: Strong, enforced boundary between extraction core and UI/storage layers (LANTERN_CORE_BOUNDARY.md:line4-104, tsconfig.json:line2-24).
- **Type guards/data validation**: Zod-based schemas, explicit type guards for distinguishing legacy and modern packs (BOOK_OF_FIXES.md:line73-97).
- **Risks:**
  - **Any change to pack schemas must maintain migration/compatibility logic**.
  - **Introducing backend persistence is non-trivial** — placeholder code only (AUDIT_REPORT.md:line73).
  - **Dependence on localStorage**: High user confusion/dissatisfaction risk if not proactively communicated.
- **Type failures and import/export breakages** have occurred before; need careful regression validation (BOOK_OF_FIXES.md:line11-12).

---

## 10. Unknowns / Missing Evidence

| Unresolved Point | Why it matters | Evidence needed |
|------------------|----------------|-----------------|
| Explicit server-side DB setup (Postgres) and example .env usage | Operators cannot enable server-side packs or DB storage without this | Example .env entries, doc'd DATABASE_URL format, migration/init guide |
| Actual API route implementations | No programmatic integration or automation is possible | server/routes.ts implementation, documented API contract |
| Integration/e2e/UI test workflow | Cannot verify app in real browser or automate QA | Test directory/command or e2e documentation |
| Migration workflow for real-world pack upgrades | No operational instructions for upgrading user packs | Migration runbook, admin tool usage demo |
| Port behavior for multiple concurrent users/real deployments | Scalability/operational safety | Real deployment case, Dockerfile, or server config doc |
| Any session/auth persistence on server | Security implications for production | Backend session implementation, server code review |
| Network security hardening/TLS in production | Data at rest/in flight is not documented as secure | Deployment scripts, reverse proxy setup, HTTPS enforcement guide |

---

## 11. Receipts

### Evidence Index (file:line):

- **Identity, Purpose & Jobs-to-be-done**
  - LANTERN_SYSTEM_SNAPSHOT.md:line10-21
- **Capability Map**
  - LANTERN_CORE_BOUNDARY.md:line10-47
  - LANTERN_SYSTEM_SNAPSHOT.md:line26-56
  - M2_SUMMARY.md:line9-43
  - AUDIT_REPORT.md:line47, line56
  - BOOK_OF_FIXES.md:line124-127
- **Architecture Snapshot**
  - AUDIT_REPORT.md:line36-44
  - LANTERN_CORE_BOUNDARY.md:line50-54
  - .replit:line1-2, 10-11, 18, 22-23
  - package.json:line6-10
- **How to Use**
  - README.md:line31-33, 40, 43, 57-58
  - package.json:line8-10
  - .replit:line1, 18
  - drizzle.config.ts:line3
  - client/src/lib/config.tsx:line4
  - BOOK_OF_FIXES.md:line32
  - M2_SUMMARY.md:line62
  - AUDIT_REPORT.md:line70
  - attached_assets/Pasted-v0-1-1-is-the-right-direction-you-attacked-the-specific_1768906402984.txt:line115
  - AUDIT_REPORT.md:line82, 90
- **Integration Surface**
  - AUDIT_REPORT.md:line22, 40, 42, 47, 56
  - client/src/lib/config.tsx:line4, 19
  - tools/verifier_package.json:line2
  - LANTERN_SYSTEM_SNAPSHOT.md:line39, 56, 27, 32, 67, 116
- **Data & Security**
  - AUDIT_REPORT.md:line56-58
  - drizzle.config.ts:line3
  - LANTERN_SYSTEM_SNAPSHOT.md:line56
  - client/src/lib/config.tsx:line4
- **Operational Reality**
  - AUDIT_REPORT.md:line70-73
  - drizzle.config.ts:line3
  - BOOK_OF_FIXES.md:line124-127
- **Maintainability & Change Risk**
  - LANTERN_CORE_BOUNDARY.md:line4-104
  - tsconfig.json:line2-24
  - BOOK_OF_FIXES.md:line73-97, 11-12
  - AUDIT_REPORT.md:line73
- **Unknowns**
  - As listed in "unknowns" section in HOWTO JSON and amplified as above

---

**End of Lantern DOSSIER.**