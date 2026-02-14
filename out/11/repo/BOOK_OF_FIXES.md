# Lantern Book of Fixes

Permanent record of high-risk incidents and remediation for audit purposes.

---

## Incident 001: lantern-extract.tsx Corruption

**Date:** 2026-01-22

### Symptom
- Build failure: `'import' and 'export' may only appear at the top level`
- LSP reporting 50+ diagnostics in single file
- Workflow unable to start

### Root Cause
Duplicate import block and partial function redefinition pasted inside component body at line 118. Structure:
```
Lines 1-117: Valid component start
Lines 118-247: Corrupted duplicate (imports + partial function + JSX fragments)
Lines 248+: Rest of original component
```

### Fix Approach
1. Added missing imports to top of file (createDossierFromExtract, Pack, useLocation)
2. Removed duplicate corrupted section (lines 118-247)
3. Restored missing function definitions (reset, toggleItem, handleLoadPack, handleCompare, downloadJSON, downloadPDF, runQualityTests)
4. Fixed type annotations (LanternPack[] → AnyPack[])
5. Fixed scoreExtraction call signature

### Verification Gates Run
- [x] `npm run build` - PASS
- [x] Import count check: 22 top-level imports
- [x] Export count check: 1 export default function
- [x] Workflow running without console errors
- [x] Manual: Extract → Promote → Editor flow

### Files Changed
- client/src/pages/lantern-extract.tsx
- client/src/lib/lanternExtract.ts (added z import, LanternPack type export)

---

## Incident 002: Type Guard Upgrade

**Date:** 2026-01-22

### Issue
Structural type discrimination using `"pack_id" in p` could accidentally overlap if schemas evolve.

### Old Pattern
```typescript
const existing = savedPacks.find(p => "pack_id" in p ? p.pack_id : p.packId);
```

### New Pattern
```typescript
// storage.ts
export function isExtractPack(p: AnyPack): p is LanternPack {
  return "schema" in p && p.schema === "lantern.extract.pack.v1";
}

export function isDossierPack(p: AnyPack): p is Pack {
  return "schemaVersion" in p && (p as Pack).schemaVersion === 2;
}

// Usage
const existing = savedPacks.find(p => isExtractPack(p) ? p.pack_id : p.packId);
```

### Verification
- [x] `npm run build` - PASS
- [x] Type guards exported and used consistently

### Files Changed
- client/src/lib/storage.ts (added type guards)
- client/src/pages/lantern-extract.tsx (updated to use guards)

---

## Incident 003: Type Guard Regression (v1 Pack Orphaning)

**Date:** 2026-01-22

### Symptom
Architect review flagged that `isDossierPack` returning true only for schemaVersion === 2 would orphan legacy v1 packs (they would fail both guards and not be migrated or displayed).

### Root Cause
Type guard was too strict - checked for exact schemaVersion match instead of detecting "is a dossier pack" semantically.

### Fix Approach
Changed `isDossierPack` to detect dossier packs by presence of `packId` AND absence of extract schema:
```typescript
export function isDossierPack(p: AnyPack): p is Pack {
  return "packId" in p && !("schema" in p && (p as any).schema === "lantern.extract.pack.v1");
}
```

This correctly identifies both v1 and v2 dossier packs for migration.

### Verification
- [x] `npm run build` - PASS
- [x] 46/46 tests pass
- [x] v1 packs will be detected and migrated by storage.loadLibrary()

### Files Changed
- client/src/lib/storage.ts

---

## Incident 004: Migration Field Transformation (Complete v1→v2)

**Date:** 2026-01-22

### Symptom
V1 pack acceptance tests failing with Zod validation errors: missing `packType`, `subjectName`, `timestamps` object, and wrong edge field names (`sourceId/targetId` vs `fromEntityId/toEntityId`).

### Root Cause
Migration logic only handled edge type remapping but not the structural field differences between v1 and v2 schemas.

### Fix Approach
Enhanced `migratePack()` to perform full field transformations:
- `createdAt/updatedAt` → `timestamps: { created, updated }`
- `title` → `subjectName`
- Added default `packType: "public_figure"`
- `sourceId/targetId` → `fromEntityId/toEntityId` on edges

### Verification
- [x] `npm run build` - PASS
- [x] 57/57 tests pass (11 new v1 pack acceptance tests)
- [x] v1 packs properly migrate and validate against PackSchema

### Files Changed
- client/src/lib/migrations.ts (enhanced field transformations)
- client/src/lib/tests/unit/v1PackMigration.test.ts (new acceptance tests)

---

## Incident 005: Wrong Landing Route / Product Identity

**Date:** 2026-01-22

### Symptom
Screenshots showed "Sovereignty Navigation System" finance dashboard (home buying, savings curves) at root route instead of investigative Lantern.

### Root Cause
`/` routed to `Dashboard` component (sovereignty finance app) instead of the investigative Lantern.

### Fix Approach
1. Created `client/src/pages/library.tsx` as investigative Lantern landing page
2. Updated `App.tsx` routing:
   - `/` → Library (extracts + dossiers listing)
   - `/legacy` → Dashboard (preserves old finance app)
3. Updated quick nav to show Library, Extract, Compare

### Verification
- [x] `npm run build` - PASS
- [x] 57/57 tests pass
- [x] `/` loads Library with investigative workflow actions
- [x] No finance language on landing

### Files Changed
- client/src/pages/library.tsx (new)
- client/src/App.tsx (routing update)

---

## Bookkeeping Standards

For any future incident:
1. Record symptom, root cause, fix approach
2. List verification gates run
3. List files changed
4. Note any behavior changes visible to users
