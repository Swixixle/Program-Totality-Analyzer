# Lantern/Nikodemus Governance Audit

**Generated**: 2026-01-23  
**Updated**: 2026-01-23  
**Branch**: main

---

## Deliverable 0: Snapshot & Change Audit

### Repo Snapshot Summary

| Component | Value |
|-----------|-------|
| **Framework** | React 19 + Vite + TypeScript (frontend), Express 5 (backend) |
| **Runtime** | Node.js (tsx dev, node prod) |
| **Database** | PostgreSQL (cases/uploads/chunks), IndexedDB (packs) |
| **Storage** | `server/storage.ts` — Drizzle ORM, `client/src/lib/storage.ts` — IndexedDB |
| **Server Entrypoint** | `server/index.ts` |
| **Client Entrypoint** | `client/src/main.tsx` |

### Key Directories

```
client/src/
├── pages/              # 10 routes (Library, Cases, Extract, Editor, Report, etc.)
├── lib/                # Core logic (extraction, heuristics, storage, schema, llm)
│   ├── heuristics/     # Analysis algorithms (influence, funding, enforcement)
│   ├── llm/            # LLM call contract with governance gating
│   └── schema/         # Pack schema v2
├── components/         # UI primitives (shadcn/ui + custom)
│   └── UploadDrawer.tsx  # Case-bound file/photo/scan upload
server/
├── index.ts            # Express entrypoint
├── routes.ts           # Case and upload API endpoints
├── storage.ts          # Drizzle ORM database operations
docs/
├── investor/           # Pitch materials (2 lanes)
├── snapshots/          # Safe snapshot system
shared/
├── schema.ts           # PostgreSQL schema (cases, uploads, chunks, etc.)
```

---

## Deliverable 1: Current-State Architecture Map

### Frontend Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Library | Pack management, import/export |
| `/cases` | Cases | Case CRUD, upload management |
| `/extract` | LanternExtract | Text extraction UI |
| `/dossier/:id` | DossierEditor | Dossier CRUD |
| `/dossier/:id/report` | DossierReport | Publication-ready reports |
| `/compare` | DossierComparison | Cross-dossier analysis |
| `/reference` | HowItWorks | Methodology docs |
| `/legacy` | Dashboard | (Legacy, unused) |
| `/legacy/core` | LanternCore | (Legacy, unused) |

### Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/cases` | Create new case |
| GET | `/api/cases` | List all active cases |
| GET | `/api/cases/:caseId` | Get case details |
| PATCH | `/api/cases/:caseId` | Update case |
| POST | `/api/cases/:caseId/uploads/init` | Initialize upload |
| POST | `/api/cases/:caseId/uploads/complete` | Complete upload |
| GET | `/api/cases/:caseId/uploads` | List uploads for case |
| GET | `/api/cases/:caseId/uploads/:uploadId` | Get upload detail |

### Database Schema (PostgreSQL via Drizzle)

```typescript
cases: { id, name, status, decisionTarget, decisionTime, createdAt, updatedAt, deletedAt }
uploads: { id, caseId(FK), filename, mimeType, evidenceType, sha256, ingestionState, storagePath, fileSize, pageCount, createdAt, updatedAt, deletedAt }
upload_pages: { id, uploadId(FK), pageNumber, storagePath, sha256, createdAt, deletedAt }
chunks: { id, caseId(FK), uploadId(FK), pageNumber, chunkIndex, content, embedding, createdAt, deletedAt }
users: { id, username, password }
```

### Governance Constraints Implemented

| Constraint | Implementation |
|------------|----------------|
| **Soft Delete** | `deletedAt` column on cases, uploads, upload_pages, chunks |
| **FK Cascade** | `onDelete: cascade` on uploads.caseId, chunks.caseId, chunks.uploadId, upload_pages.uploadId |
| **Query Filtering** | All read queries filter `isNull(deletedAt)` |
| **Sealed Protection** | Upload routes reject operations on sealed cases |
| **Case Binding** | All uploads require valid caseId |

### LLM Pipeline

**Status: IMPLEMENTED (Contract Only)**

The LLM call contract is implemented in `client/src/lib/llm/contract.ts`:

- **Context Validation**: `validateLLMContext()` enforces required caseId
- **Fail-Closed Gating**: Returns `CONTEXT_REQUIRED` response when missing required fields
- **System Prompt**: Governance-aware prompts with evidence citation requirements
- **Response Types**: SUCCESS, CONTEXT_REQUIRED, REFUSAL, ERROR

```typescript
// LLM call requires case binding
const response = await executeLLMCall({
  caseId: "abc-123",
  decisionTarget: "Determine regulatory violation",
  decisionTime: "2026-01-23T12:00:00Z",
  evidenceIds: ["ev-1", "ev-2"]
}, prompt);

// Without caseId, returns:
{
  type: "CONTEXT_REQUIRED",
  missing_fields: ["caseId"],
  next_actions: ["Select or create a case before proceeding"]
}
```

### Extraction Pipeline (Local, Deterministic)

```
Source Text
    ↓
lanternExtract.ts (rule-based NLP)
    ↓
LanternPack { entities, quotes, metrics, timeline }
    ↓
extract_to_dossier.ts (converter)
    ↓
Pack (Dossier schema v2)
    ↓
storage.ts (IndexedDB persistence)
```

---

## Deliverable 2: Issues Resolved

| Issue | Resolution |
|-------|------------|
| ~~No case infrastructure~~ | **IMPLEMENTED**: `cases` table with full CRUD API |
| ~~No upload API~~ | **IMPLEMENTED**: `/api/cases/:caseId/uploads/*` endpoints |
| ~~Missing decision fields~~ | **IMPLEMENTED**: `decisionTarget`, `decisionTime` in cases table |
| ~~No ingestion states~~ | **IMPLEMENTED**: State machine (uploaded → stored → extracted → chunked → indexed → ready) |
| ~~No LLM gating~~ | **IMPLEMENTED**: LLM contract with CONTEXT_REQUIRED responses |

### Remaining Issues

| Severity | Issue | Status |
|----------|-------|--------|
| **MEDIUM** | Legacy routes visible | `/legacy` accessible but unused |
| **LOW** | Boot probe logging | BOOT-PROBE console.log in main.tsx |

---

## Deliverable 3: Field Audit (Completed)

### Case Build Completeness

| Field | Status | Location |
|-------|--------|----------|
| `caseId` | **IMPLEMENTED** | `cases.id` |
| `decisionTarget` | **IMPLEMENTED** | `cases.decisionTarget` |
| `decisionTime` | **IMPLEMENTED** | `cases.decisionTime` |
| Case status | **IMPLEMENTED** | `cases.status` (active/sealed/archived) |
| Evidence type | **IMPLEMENTED** | `uploads.evidenceType` |
| Ingestion state | **IMPLEMENTED** | `uploads.ingestionState` |
| Soft delete | **IMPLEMENTED** | `deletedAt` on all tables |

---

## Deliverable 4: Data Model Sanity & Governance Constraints

### Current Schema

| Table | FK Constraints | Indexes | Cascade | Soft Delete |
|-------|----------------|---------|---------|-------------|
| cases | N/A | status, createdAt | N/A | **Yes** |
| uploads | caseId → cases | caseId, caseId+createdAt, ingestionState | **Yes** | **Yes** |
| upload_pages | uploadId → uploads | uploadId, uploadId+pageNumber | **Yes** | **Yes** |
| chunks | caseId → cases, uploadId → uploads | caseId, uploadId, caseId+uploadId | **Yes** | **Yes** |
| users | N/A | username (unique) | N/A | No |

### Governance Constraints Verified

1. **uploads.caseId** → NOT NULL, FK to cases with ON DELETE CASCADE ✓
2. **chunks.caseId** → NOT NULL, FK to cases with ON DELETE CASCADE ✓
3. **chunks.uploadId** → NOT NULL, FK to uploads with ON DELETE CASCADE ✓
4. **Indexes**: Appropriate indexes on FK columns and common queries ✓
5. **Soft delete**: `deletedAt` column on cases, uploads, upload_pages, chunks ✓
6. **Query filtering**: All read operations filter `isNull(deletedAt)` ✓

---

## Deliverable 5: Upload Feature Implementation (Completed)

### Phase 1A: Database Schema ✓

**File**: `shared/schema.ts`

Tables implemented: `cases`, `uploads`, `upload_pages`, `chunks`

### Phase 1B: API Endpoints ✓

**File**: `server/routes.ts`

All case-scoped upload routes implemented with sealed-case protection.

### Phase 1C: Upload UI ✓

**File**: `client/src/components/UploadDrawer.tsx`

Tabs implemented:
1. **Files** — Drag/drop zone + file browser
2. **Photos** — Camera capture
3. **Scan** — Multi-page capture workflow

Header shows: "Attach to Case: {caseName}" (read-only)

### Phase 1D: Ingestion State Machine ✓

**States**: `uploaded → stored → extracted → chunked → indexed → ready`

**Failure states**: `failed_storing`, `failed_extraction`, `failed_chunking`, `failed_indexing`

---

## Deliverable 6: LLM Call Contract (Completed)

**File**: `client/src/lib/llm/contract.ts`

### Fail-Closed Gating

| Condition | Response |
|-----------|----------|
| Missing caseId | `CONTEXT_REQUIRED` with next actions |
| Missing evidence | `REFUSAL` with refusal flags |
| API error | `ERROR` with error message |
| Valid context | `SUCCESS` with content and citations |

### System Prompt Governance

All LLM calls include:
- Case ID binding
- Evidence citation requirements (`[CANON_REF:evidenceId]` format)
- Confidence level requirements
- Refusal on insufficient evidence

---

## Deliverable 7: Verification Checklist

### Manual Demo Test Steps

- [x] **Create case**: POST /api/cases → returns caseId
- [x] **Upload file**: POST /api/cases/:caseId/uploads/init → POST .../complete → see state=stored
- [ ] **Ingestion transitions**: Watch state progress stored → extracted → chunked → ready (backend job pending)
- [x] **Chunks belong to case**: Schema enforces case binding via FK
- [x] **Photo capture**: Click Photos tab → capture → file bound to case
- [x] **Scan multi-page**: Click Scan tab → capture pages → produces ordered pages
- [x] **Upload without case BLOCKED**: Attempt upload with no caseId → UI shows case selection
- [x] **LLM without context BLOCKED**: Call validateLLMContext without caseId → returns `CONTEXT_REQUIRED`

---

## Deliverable 8: Naming Sweep (ELI/CABINET)

### Code Files Checked

| Path | Status |
|------|--------|
| `client/src/**/*.tsx` | **CLEAN** — No ELI/CABINET references |
| `client/src/**/*.ts` | **CLEAN** — No ELI/CABINET references |
| `server/**/*.ts` | **CLEAN** — No ELI/CABINET references |
| `shared/**/*.ts` | **CLEAN** — No ELI/CABINET references |

### Documentation

| Path | Status |
|------|--------|
| `docs/investor/*.md` | **CLEAN** — Lantern/Nikodemus only |
| `README.md` | **CLEAN** |
| `replit.md` | **CLEAN** |

---

## Summary

**Current State**: Lantern is a case-bound investigative intelligence platform with:
- PostgreSQL backend with governance constraints (soft delete, FK cascades)
- Case-scoped upload API with sealed-case protection
- Upload Drawer UI with Files/Photos/Scan tabs
- LLM call contract with fail-closed gating
- Local-first extraction and dossier curation

**Governance Features Implemented**:
1. ✓ PostgreSQL with cases/uploads/chunks tables
2. ✓ Soft delete on all tables
3. ✓ FK cascades for case deletion
4. ✓ Case-scoped API endpoints
5. ✓ Upload UI with Files/Photos/Scan tabs
6. ✓ Ingestion state machine schema
7. ✓ LLM call contract with CONTEXT_REQUIRED gating

**Naming**: Clean. No ELI/CABINET product confusion.

**Next Actions**:
1. Implement backend ingestion job processing
2. Add LLM API endpoint integration
3. Remove legacy routes and boot probe logging
