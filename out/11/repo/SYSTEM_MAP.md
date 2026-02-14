# LANTERN SYSTEM MAP

Complete architectural documentation of the Lantern Evidentiary Record System.
Suitable for internal audit, legal review, and future maintainers.

---

## A. High-Level Architecture

### Pages and Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Library | Landing page. Lists extract packs and dossier packs. Entry point for workflow. |
| `/extract` | LanternExtract | Text extraction interface. Produces Extract Packs from source text. |
| `/dossier/:id` | DossierEditor | CRUD interface for dossier curation (entities, edges, claims, evidence). |
| `/dossier/:id/report` | DossierReport | Read-only report view with heuristic analysis and integrity fingerprints. |
| `/compare` | DossierComparison | Cross-dossier comparison with structural alignment and fingerprint binding. |
| `/reference` | HowItWorks | Reference documentation. Method, limits, safeguards. |
| `/legacy` | Dashboard | Archived finance dashboard (not part of Lantern v1 workflow). |

### Major Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| `lanternExtract.ts` | `client/src/lib/` | Deterministic text extraction engine. Produces entities, quotes, metrics, timeline. |
| `storage.ts` | `client/src/lib/` | IndexedDB persistence layer. Pack storage, retrieval, type guards. |
| `migrations.ts` | `client/src/lib/` | Schema migration (v1 → v2). Field transformations, migration logging. |
| `integrity.ts` | `client/src/lib/` | SHA-256 fingerprint generation for reports and comparisons. |
| `comparison.ts` | `client/src/lib/` | Cross-dossier structural comparison. Jaccard index, entity matching. |
| `heuristics/` | `client/src/lib/heuristics/` | `influenceHubs.ts`, `fundingGravity.ts`, `enforcementMap.ts`, `sensitivity.ts` |
| `pack_v1.ts` | `client/src/lib/schema/` | Zod schema definitions for Pack v2, entities, edges, claims, evidence. |

### Data Flow

```
Source Text → Extract → Extract Pack → Promote → Dossier Pack → Edit → Analysis → Report → Export
                                                    ↓
                                               Compare (2 packs)
```

---

## B. Data Lifecycle

### Extract → Dossier → Analysis → Report → Export

1. **Extract**: User pastes text → `lanternExtract.ts` extracts structured items → Extract Pack created
2. **Promote**: User promotes Extract Pack → Dossier Pack scaffolded from extracted entities
3. **Edit**: User curates dossier (add/remove entities, edges, claims, evidence)
4. **Analysis**: Report page runs heuristics on dossier data
5. **Report**: Structured report generated with findings, limits, fingerprint
6. **Export**: Markdown export with YAML frontmatter, suitable for version control

### Where Migrations Occur

- **On Load**: `storage.loadLibrary()` runs `migratePack()` on all dossier packs
- **Trigger**: Any pack with `schemaVersion < 2` or missing v2 fields
- **Log**: All transformations recorded in `pack.migrationLog[]`

### Where Integrity Checks Occur

- **Report Generation**: SHA-256 fingerprint computed from canonical pack data
- **Comparison**: Both pack fingerprints plus comparison fingerprint generated
- **Export**: Fingerprints embedded in YAML frontmatter

### Where Refusal / Gating Occurs

- **Heuristics**: If edge count < threshold, returns `status: "INSUFFICIENT_DATA"`
- **Comparison**: If either pack lacks sufficient data, shows "Analysis Unavailable"
- **Sensitivity**: If removal simulation cannot run, section omitted

---

## C. Schema & Versioning

### Pack Types

| Type | Discriminator | Schema |
|------|---------------|--------|
| Extract Pack | `schema: "lantern.extract.pack.v1"` | `LanternPack` type |
| Dossier Pack | `packId` present, no extract schema | `Pack` type (v2) |

### Type Guards

```typescript
// storage.ts
export function isExtractPack(p: AnyPack): p is LanternPack {
  return "schema" in p && p.schema === "lantern.extract.pack.v1";
}

export function isDossierPack(p: AnyPack): p is Pack {
  return "packId" in p && !("schema" in p && (p as any).schema === "lantern.extract.pack.v1");
}
```

### Migration Strategy

| v1 Field | v2 Field | Transformation |
|----------|----------|----------------|
| `createdAt`, `updatedAt` | `timestamps: { created, updated }` | Nested object |
| `title` | `subjectName` | Rename |
| (missing) | `packType` | Default to `"public_figure"` |
| `sourceId`, `targetId` (edges) | `fromEntityId`, `toEntityId` | Rename |
| Unknown edge types | `"affiliated_with"` | Remap with notes |

### Backward Compatibility

- `isDossierPack` detects both v1 and v2 packs by checking for `packId` presence
- Migration runs automatically on load, transparent to user
- Original values preserved in notes/migrationLog for audit

---

## D. Heuristic Pipeline

### Influence Hubs

| Property | Value |
|----------|-------|
| **Inputs** | All edges in dossier |
| **Threshold** | Minimum 3 edges total |
| **Computation** | Degree centrality (count of edges per entity) |
| **Output** | Ranked list of entities by connection count |
| **Failure Mode** | `INSUFFICIENT_DATA` if < 3 edges |

### Funding Gravity

| Property | Value |
|----------|-------|
| **Inputs** | Edges of type: `funded_by`, `donated_to`, `donated_by`, `sponsored_by`, `grant_from`, `grant_to` |
| **Threshold** | Minimum 2 funding edges |
| **Computation** | Count inflows/outflows per entity |
| **Output** | Funding concentration map |
| **Failure Mode** | `INSUFFICIENT_DATA` if < 2 funding edges |

### Enforcement Map

| Property | Value |
|----------|-------|
| **Inputs** | Edges of type: `censored_by`, `banned_by`, `sued_by`, `threatened_by`, `fired_by`, `investigated_by`, `sanctioned_by` |
| **Threshold** | Minimum 1 enforcement edge |
| **Computation** | List of coercive relationships |
| **Output** | Enforcement edge inventory |
| **Failure Mode** | `INSUFFICIENT_DATA` if no enforcement edges |

### Sensitivity / Robustness

| Property | Value |
|----------|-------|
| **Inputs** | All heuristic outputs |
| **Threshold** | At least 2 data points for meaningful test |
| **Computation** | Simulate removal of each entity/edge, check if findings persist |
| **Output** | Stability classification: ROBUST, FRAGILE, SINGLE_POINT |
| **Failure Mode** | Skipped if insufficient base data |

---

## E. Integrity & Safety Layers

### Report Fingerprinting

- **Algorithm**: SHA-256
- **Input**: Canonical JSON of pack data (sorted keys, sorted arrays)
- **Output**: 64-character hex string
- **Location**: Report header, YAML frontmatter in export

### Comparison Fingerprinting

- **Fingerprint A**: SHA-256 of Pack A
- **Fingerprint B**: SHA-256 of Pack B
- **Comparison Fingerprint**: SHA-256 of (Fingerprint A + Fingerprint B + comparison timestamp)
- **Purpose**: Tamper-evidence binding two packs at comparison time

### Migration Logs

- **Storage**: `pack.migrationLog: string[]`
- **Content**: ISO timestamp + description of transformation
- **Display**: Shown in report under "Migration Notes" section
- **Purpose**: Audit trail for schema changes

### Sensitivity Analysis

- **Method**: Remove each entity/edge, rerun heuristics
- **Output**: Which findings survive single-point removal
- **Classification**: 
  - `ROBUST`: Finding survives all removals
  - `FRAGILE`: Finding disappears on some removals
  - `SINGLE_POINT`: Finding depends on exactly one data point

---

## F. UX Boundaries

### What Users Can Do

- Create extract packs from source text
- Promote extracts to dossiers
- Add/edit/delete entities, edges, claims, evidence
- Run heuristic analysis (automatic on report view)
- Export reports as Markdown
- Compare two dossiers
- View reference documentation

### What Users Cannot Do

- Override insufficiency gating
- Force analysis without meeting thresholds
- Edit fingerprints or migration logs
- Modify heuristic thresholds
- Access production database (local-first only)

### Where Lantern Refuses Action

| Scenario | Behavior |
|----------|----------|
| < 3 edges for Influence Hubs | "Insufficient Data" displayed |
| < 2 funding edges for Funding Gravity | "Insufficient Data" displayed |
| No enforcement edges | "No Enforcement Edges Detected" |
| Comparison with insufficient pack | "Analysis Unavailable" for that section |
| Invalid pack schema on import | Pack skipped (binary dedupe policy) |
| Migration validation failure | Error thrown, pack not loaded |

---

## G. File Structure

```
client/src/
├── App.tsx                    # Router, hamburger menu
├── pages/
│   ├── library.tsx            # Landing page (/)
│   ├── lantern-extract.tsx    # Text extraction (/extract)
│   ├── dossier-editor.tsx     # Dossier CRUD (/dossier/:id)
│   ├── dossier-report.tsx     # Report view (/dossier/:id/report)
│   ├── dossier-comparison.tsx # Comparison (/compare)
│   ├── how-it-works.tsx       # Reference (/reference)
│   ├── dashboard.tsx          # Legacy (/legacy)
│   └── not-found.tsx          # 404
├── lib/
│   ├── lanternExtract.ts      # Extraction engine
│   ├── storage.ts             # Persistence + type guards
│   ├── migrations.ts          # v1 → v2 migration
│   ├── integrity.ts           # SHA-256 fingerprinting
│   ├── comparison.ts          # Cross-dossier analysis
│   ├── guardrails.ts          # Validation rules
│   ├── schema/pack_v1.ts      # Zod schemas
│   └── heuristics/
│       ├── influenceHubs.ts   # Influence Hubs
│       ├── fundingGravity.ts  # Funding Gravity
│       ├── enforcementMap.ts  # Enforcement Map
│       ├── sensitivity.ts     # Robustness analysis
│       └── types.ts           # Shared heuristic types
└── components/                # shadcn/ui components
```

---

## H. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-22 | Initial release. M1-M12 complete. |
| Post-v1 | 2026-01-22 | Migration hardening, type guards, route identity fix, reference panel |

---

*This map reflects the implementation as of the latest checkpoint.*
