---
title: Lantern Program Totality Dossier
generated_by: PTA / Lantern
mode: deterministic+curated
date: 2026-02-14
---

# HALO-RECEIPTS: Program Totality Analyzer Dossier

---

## 1. **Identity of Target System**

**What it IS:**  
HALO-RECEIPTS (AI Receipts) is a forensic verification system specifically designed for AI conversation transcripts. It provides cryptographic verification (SHA-256, Ed25519), immutable receipt storage, tamper-evident audit trails, forensic export capabilities, and extensive auditing for post-hoc analysis. This system is both the backend API server (Node.js/Express/PostgreSQL/Drizzle ORM) and a modern React UI, bundling forensic guarantees directly into receipt management and export (README.md:3,9,60–61; replit.md:4,11–12,14–24).

**What it is NOT:**  
- **Not a real-time monitoring, content moderation, or multi-operator platform:** It is not designed for live chat moderation, direct truth judgment, or multi-user concurrency at the enforcement level (replit.md:55).
- **Not a database engine:** Instead, it relies on PostgreSQL for durable state.
- **Not a data lake or generic file archival platform.**
- **Not a replacement for WORM-compliant log systems, but can integrate via checkpoint anchoring (see below).**
- **Not a deployment framework:** The system expects to be deployed behind a reverse proxy or PaaS (README.md:24; SECURITY.md:54).

---

## 2. **Purpose & Jobs-to-be-done**

- **Forensic Conversation Integrity:** Operators can guarantee, via public proofs, that a transcript or "receipt" has not been tampered with since its recording date (README.md:9; replit.md:4).
- **Immutable Logging & Audit Trails:** Ensures all receipt actions (append, lock, kill switch, export, audit actions) are tracked in an append-only, hash-linked audit log, detecting insertions, deletions, reordering, and version tampering (SECURITY.md:8–10; STATE.md:165–169).
- **Cryptographic Verification:** Verifies that every receipt chain and audit log entry is both hash-linked (SHA-256) and checkpoint signed (Ed25519), with optional external anchoring (replit.md:36–46; STATE.md:116–121).
- **Forensic Export and Proof Packs:** Allows export of forensic packs (JSON) that can be offline verified and admitted as tamper-evident evidence (STATE.md:122–125; scripts/ci-forensic-gate.sh).
- **Regulatory Alignment:** System features mapped to compliance goals (21 CFR, HIPAA, SOC2, etc.) (replit.md:50, STATE.md:137).
- **Operator/Evidence Reliability:** Designed to provide demonstrable evidence for courts, regulators, or internal review.

---

## 3. **Capability Map**

| Capability             | Mechanism / Implementation | Evidence                                    |
|------------------------|---------------------------|---------------------------------------------|
| SHA-256 Hash Verification   | Canonicalized (c14n-v1) JSON hash | README.md:73–74; STATE.md:17,20             |
| Ed25519 Signatures     | Checkpoint signing, chain   | STATE.md:18,116–121; replit.md:36           |
| Immutable Storage      | Receipt lock, no mutation  | README.md:75; STATE.md:21,158–159           |
| Kill Switch            | Irreversible flag, disables outputs | README.md:76; STATE.md:22,157                |
| Audit Logs             | Append-only, hash-chained table | STATE.md:25–29,162                           |
| Forensic Export/Import | export_forensic_pack, verify_forensic_pack scripts | STATE.md:123–126                              |
| Forensic Sensors       | Interpreter, summarizer, claim extractor | README.md:78; STATE.md:80,85                  |
| Policy Enforcement     | Zod schemas, request shape limits | SECURITY.md:20–23                            |
| API Rate Limiting      | Per-IP, in-memory          | SECURITY.md:26–29; STATE.md:94; package.json:61 |
| Key Rotation & Anchoring | Multi-key support, anchor backends | replit.md:43–47                            |
| Secure API Structure   | API_KEY in x-api-key header; private/public endpoints | SECURITY.md:15–16,72                           |
| Client Auth Isolation  | LLMs see only transcript content | SECURITY.md:39–40; STATE.md:160,20           |
| UI Export & Compare    | Side-by-side comparison, JSONL/CSV export | README.md:143; replit.md:25,23                |
| Structured Logging     | JSON logs, in-memory counters | STATE.md:106–107,184                          |
| Health Checks          | /api/health, /api/ready    | STATE.md:37,43,100–101; docs/API_CONTRACTS.md:11,24 |

---

## 4. **Architecture Snapshot**

- **Frontend:** React (wouter router), Tailwind, shadcn/ui (README.md:59, client/src/App.tsx)
- **Backend:** Node.js 20, Express, Drizzle ORM (README.md:60–61; package.json)
- **Database:** PostgreSQL 14+ (README.md:24, .env.example:5)
- **Cryptography:** Node.js crypto (SHA-256), Ed25519 (STATE.md:18,116)
- **Session:** express-session, connect-pg-simple (package.json:51,57)
- **Audit Trail:** Hash-linking via prev_hash and payload_v, audit_head singleton row (STATE.md:9,25–29,48,52; drizzle.config.ts:9)
- **Forensic Export:** TypeScript scripts in `/scripts`, results in JSON proof packs (STATE.md:123–126)
- **CI/CD:** GitHub Actions, drift guard scripts, reproducible verifier zips (replit.md:39–42,57)

---

## 5. **How to Use the Target System**

### **Operator Manual**

#### **A. Prerequisites**

1. **Install:**
   - Node.js 20+, npm (`npm -v`/`node -v`)
   - PostgreSQL 14+ running and accessible (README.md:23–24)
   - jq, unzip, python3 for export/ops scripts (see replit.nix, scripts/ci-forensic-gate.sh)
   - TypeScript, tsx, drizzle-kit, installed via npm as devDependencies (package.json)

#### **B. Installation**

1. **Clone Repository**
2. `npm install`  
   Installs all dependencies (README.md:29)
3. `cp .env.example .env`  
   Copy template env config (README.md:33)
4. **Edit `.env`**:  
   Set `DATABASE_URL`, `API_KEY`, `SESSION_SECRET` and all other required variables suitably (README.md:34; .env.example:5,10,23)
5. **(Optional: Replit):**
   - Use the "Run on Replit" badge or Replit sidebar GUI (README.md:17)

#### **C. Configuration**

Set the following in `.env` (names only, do not provide values):
- **DATABASE_URL:** PostgreSQL connection string (.env.example:5)
- **API_KEY:** Required for private endpoints (.env.example:10; SECURITY.md:15)
- **SESSION_SECRET:** Strong, random string (.env.example:23; SECURITY.md:71)
- **NODE_ENV:** development/production (.env.example:13)
- **PORT:** Default 5000 (.env.example:14)
- Other optional: TRANSCRIPT_MODE, CHECKPOINT_INTERVAL, CHECKPOINT_ANCHOR_TYPE, etc. (.env.example, STATE.md:118, replit.md:45)

#### **D. Database Init**

- Run: `npm run db:push`  
  This applies the schema to PostgreSQL (README.md:39)

#### **E. Development Server**

- Run: `npm run dev`  
  Runs server in development mode (README.md:44)
- Visit: [http://localhost:5000](http://localhost:5000) (README.md:47)

#### **F. Production Build**

- Run: `npm run build`  
  Compile frontend and backend (README.md:52)
- Set `NODE_ENV=production`, then  
  `npm run start` (README.md:53)
- Server now on port specified in env (default 5000) (README.md:47, .replit:10,14, .env.example:14)

#### **G. Example API Usage**

- Health Check:  
  `curl http://localhost:5000/api/health` (docs/API_CONTRACTS.md:11)
- Readiness:  
  `curl http://localhost:5000/api/ready` (docs/API_CONTRACTS.md:24)
- Verify Audit (requires API_KEY):  
  `curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify` (docs/API_CONTRACTS.md:64)
- Create & Lock Receipts, Get all Receipts, Kill Switch, etc.:  
  See usage_examples in HOWTO (docs/API_CONTRACTS.md)

#### **H. Verification & Forensics**

- Check schema: `npm run db:push` (README.md:39)
- Verify audit chain:  
  `curl -H "x-api-key: <API_KEY>" http://localhost:5000/api/audit/verify` (STATE.md:206)
- Export forensic pack:**  
  `npx tsx scripts/export_forensic_pack.ts --output <pack.json>`
- Offline verify pack:  
  `npx tsx scripts/verify_forensic_pack.ts <pack.json>` (scripts/ci-forensic-gate.sh:42)
- Tamper detection: run the same after editing pack, expect fail (scripts/ci-forensic-gate.sh:61–84)
  
#### **I. Common Failures**

| Symptom                        | Cause                              | Fix                                                  | Evidence                |
|--------------------------------|------------------------------------|------------------------------------------------------|-------------------------|
| 401 Unauthorized               | Wrong/missing API_KEY              | Set correct `x-api-key` header, check .env           | SECURITY.md:15          |
| DB connection errors/crash     | Bad DATABASE_URL, DB offline/wrong | Check credentials, service, version                  | drizzle.config.ts:3     |
| Server not running on port     | App not started, port conflict     | Check logs, ensure PORT=5000, check if in use        | .replit:10              |
| Forensic pack tamper undetected| Bug or script not installed        | Re-export, ensure proper script in place             | scripts/ci-forensic-gate.sh:61–84 |

---

## 6. **Integration Surface**

- **REST API:**  
  Well-documented REST endpoints (`/api/health`, `/api/ready`, `/api/receipts`, `/api/audit/verify`, `/api/receipts/:id/lock`, `/api/receipts/:id/kill-switch`, etc.) (docs/API_CONTRACTS.md)
- **API Authentication:**  
  API key required for all non-public (write or sensitive) endpoints via `x-api-key` HTTP header (SECURITY.md:15, .env.example:10)
- **Webhooks:**  
  Unknown — evidence needed: No explicit webhook example or config found for outbound push/integrations.
- **Data Formats:**  
  JSON REST, all API schemas validated by Zod (STATE.md:95; SECURITY.md:20).
- **Export/Import:**  
  Forensic packs as canonical JSON, offline verifier script can process proof packs and verify signatures (STATE.md:123–125)
- **SDKs:**  
  None provided; interaction via HTTP API and TypeScript scripts.

---

## 7. **Data & Security Posture**

- **Data Storage:**  
  All core state in PostgreSQL (receipts, audit trail, checkpoints; .env.example:5; README.md:61)
- **Immutable guarantees:**  
  Lock and kill-switch state prevent subsequent edits (README.md:75,76; STATE.md:21–22)
- **Audit Log:**  
  Hash-linked, append-only, verified at both write and operator demand (STATE.md:25–29)
- **Cryptography:**  
  Canonical JSON SHA-256 for all payloads, Ed25519 for checkpoint signing (STATE.md:17–19,116)
- **External Anchoring:**  
  Pluggable anchors (LogOnly, S3WormAnchor, Rfc3161TsaAnchor), config via `CHECKPOINT_ANCHOR_TYPE` (replit.md:45; STATE.md:170–173)
- **Authentication:**  
  API_KEY via header for all writes and sensitive queries, stored only as secret (SECURITY.md:15–17,72,84)
- **Input Validation:**  
  Zod schemas, 1MB max body, JSON only, UTF-8 validation (SECURITY.md:20–23)
- **Rate Limiting:**  
  Per-IP, endpoint and overall, in-memory only (SECURITY.md:26–29; STATE.md:94)
- **Headers:**  
  X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy (SECURITY.md:32–36; STATE.md:97)
- **Session Security:**  
  express-session with SESSION_SECRET, connect-pg-simple store (package.json:51,57; .env.example:23)
- **No Logging of Secrets:**  
  Explicitly forbidden, audit logs never include `API_KEY`/secrets (SECURITY.md:17,90)

---

## 8. **Operational Reality**

- **Server:**  
  Runs via `npm run dev` (development) or production `npm run build && npm run start` (README.md:44,52–53; .replit:2,18)
- **Port:**  
  Default 5000 (README.md:47; .env.example:14; .replit:10,14)
- **Database:**  
  PostgreSQL 14+ required and always available; credentials in env (README.md:24; drizzle.config.ts)
- **Secrets:**  
  All secrets via `.env`; no default session or API key in production (SECURITY.md:84)
- **No Built-in TLS:**  
  Not exposed directly; deploy behind HTTPS proxy (SECURITY.md:54; README.md:24)
- **CI/CD:**  
  Github Actions runs type check, db:push, tests, drift guards, build, releases artifacts (STATE.md:111; replit.md:39–42)
- **Counters/Rate-Limits:**  
  In-memory, reset on process restart (STATE.md:107; SECURITY.md:62–64)
- **Persistent Storage:**  
  No special data directory—state in PostgreSQL only.
- **Logs:**  
  Structured JSON to console; location for interactive review unknown — evidence needed (STATE.md:106)

---

## 9. **Maintainability & Change Risk**

- **Well Bounded:**  
  Security, business logic, and cryptography are isolated and formalized (STATE.md:149–162)
- **Explicit Invariants and Forbidden Practices:**  
  Canonicalization pipeline, no mock data, strict version/hashing rules (STATE.md:149–162,186–193)
- **Codebase Size:**  
  Large (`routes.ts` >2k lines); risk for routing/merge conflicts (STATE.md:183)
- **Rate Limiter Limitation:**  
  In-memory counters/rate-limiting, resets on restart; persistence is a punchlist item (STATE.md:184,219)
- **Key rotation and signature abstraction:**  
  Documented plan, proof-tested, rotation protocol in THREAT_MODEL.md (replit.md:43–44,60)
- **Danger Areas:**  
  Fully-privileged DB admin can bypass all checks without external anchor; risk documented (STATE.md:172–173).
- **Tests:**  
  42 tests (STATE.md:194). CI runs coverage, canonicalization, audit drift/adapter boundary guards (STATE.md:111–114)

---

## 10. **Replit Execution Profile**

- **Default Replit run:** `npm run dev` ([.replit:2])
- **Modules:** Node 20, PostgreSQL 16, web via Replit ([.replit:1])
- **PORT:** 5000 (mapped to external 80) ([.replit:10–11,14])
- **Build on Deploy:** Runs `npm run build` ([.replit:19])
- **Production Entrypoint:** `node ./dist/index.cjs` ([.replit:18])
- **Replit Special Integration:** VITE_DEV_API_KEY set for development ([.replit:45]), GitHub integration possible ([.env.example:27–29])
- **Nix Packages:** jq, unzip for ops scripts ([.replit:7])

---

## 11. **Unknowns / Missing Evidence**

| What is Missing | Why It Matters | Evidence Needed |
|-----------------|----------------|----------------|
| Production deployment details outside Replit (systemd/Docker/PM2) | Real-world ops, non-Replit platforms | Dockerfile, systemd service, or reverse proxy config |
| Database initialization beyond drizzle-kit | Custom DB/user privileges, stateful setups | Database schema, role guides, SQL init scripts |
| Key rotation/generation procedure for API_KEY or SESSION_SECRET | Long-term ops, secops | Step-by-step key management documentation |
| Log path or viewing commands | Troubleshooting, support | Log file locations or sample log tail commands |
| Standalone front-end hosting commands | Non-Replit, split hosting | Front-end build/start manual, production hosting instructions |
| Webhooks or outbound events | Integration with SIEM/alerting | Outbound webhook config or documentation |

---

## 12. **Receipts (Evidence Index)**

**All claims above are strictly supported by:**

- **README.md:** lines 3,9,17–47,52–56,59–79,90.
- **replit.md:** lines 4,11–61 (core capabilities, architecture).
- **.env.example:** lines 5,10,13,14,18,23,27–29.
- **STATE.md:** lines 17–23,25–48,49–212,149–162,165–193,194–214 (invariants, tests, capability inventory, ops, threat model, audit chain).
- **SECURITY.md:** lines 8–17,20–29,32–36,39–41,54,62–64,71–90.
- **drizzle.config.ts:** line 3 (database connectivity).
- **.replit:** lines 2,10,14,18–19,45 (Replit settings).
- **package.json:** dev/prod dependencies, scripts: "dev", "build", "start", "db:push" (lines 7–12,51,57,61).
- **docs/API_CONTRACTS.md:** endpoints, usage examples.
- **scripts/ci-forensic-gate.sh:** lines 42,61–84 (forensic scripts).
- **client/src/App.tsx & components:** UI routes, health/audit banners.
  
**Specific references cross-index with HOWTO JSON, which extracts and hashes the underlying source text (e.g., README.md:39).**

---

**End of Dossier.**