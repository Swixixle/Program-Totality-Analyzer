# Lantern Product Plan

**Phase**: 2 (Productization) → **v1 Complete**
**Status**: v1 Feature Complete
**Date**: January 22, 2026

---

## 1. Product Definition

Lantern is an investigative journalism intelligence platform that enables analysts to curate dossiers, apply Shadow-Caste heuristics to detect structural patterns, and generate publication-ready reports with rigorous epistemic safety controls and cryptographic integrity verification.

**Target User**: Investigative Journalists, Financial Analysts, and Researchers who need rigorous, auditable analysis.

### Core Features (v1 Complete)
1.  **Text Extraction**: Structured extraction from unstructured text (Entities, Quotes, Metrics, Timeline)
2.  **Dossier Curation**: Full CRUD for entities, edges, claims, evidence
3.  **Shadow-Caste Heuristics**: Influence Hubs, Funding Gravity, Enforcement Map
4.  **Epistemic Safety**: Evidence density thresholds, interpretation limits, disclaimers
5.  **Report Generation**: Publication-ready reports with cryptographic fingerprints
6.  **Cross-Dossier Comparison**: Entity overlap, structural alignment, comparison integrity

---

## 2. Module Status (M1-M12)

### Completed Modules

| Module | Name | Status | Description |
|--------|------|--------|-------------|
| M1 | Pack Schema & Storage | ✅ DONE | IndexedDB persistence, Pack v2 schema |
| M2 | Dossier Editor | ✅ DONE | Entity, edge, claim, evidence CRUD |
| M3 | Heuristic Analysis | ✅ DONE | Influence, Funding, Enforcement heuristics |
| M4 | Evidence Density | ✅ DONE | Minimum thresholds, insufficient data gating |
| M5 | Report Generation | ✅ DONE | Structured report view |
| M6 | Markdown Export | ✅ DONE | Full report export with YAML frontmatter |
| M7 | Interpretation Limits | ✅ DONE | Disclaimers, "what this doesn't prove" |
| M8 | Migration Transparency | ✅ DONE | Schema version tracking in reports |
| M9 | Print Layout | ✅ DONE | Print-optimized CSS |
| M10 | Claim Scope | ✅ DONE | utterance vs content attribution |
| M11 | Robustness Checks | ✅ DONE | Sensitivity analysis, stability classification |
| M12 | Comparison Integrity | ✅ DONE | SHA-256 fingerprints, tamper-evidence |

---

## 3. Post-v1 Hardening (COMPLETE)

### Technical Hardening
- [x] Type guards cleanup (isExtractPack, isDossierPack) - with v1/v2 compatibility
- [x] Migration logic enhanced: v1→v2 field transformations
- [x] Determinism verification for fingerprints
- [x] V1 pack acceptance tests (57/57 passing)

### UX Polish
- [x] Report view: print CSS, interpretation limits callout
- [x] Comparison view: stats cards, match badges, unavailable blocks
- [x] Editor view: claim scope helpers with explanatory text

### Documentation
- [x] CHANGELOG.md created
- [x] BOOK_OF_FIXES.md created (incident tracking)
- [x] PRODUCT_PLAN.md updated

### IA/Entry Route
- [x] Root route `/` → Library (investigative Lantern landing)
- [x] Legacy dashboard moved to `/legacy`
- [x] Quick nav: Library, Extract, Compare

---

## 4. Architecture Decision Record

### Client/Server Split
- **Decision**: Client-Heavy (Thick Client)
- **Rationale**: All analysis runs in-browser for zero latency, offline capability, and privacy

### Persistence Strategy
- **Current**: IndexedDB (Browser)
- **Future**: Optional Postgres backend

### Type Discrimination
- **Pattern**: Explicit schema literals via type guards
- **Extract Pack**: `schema === "lantern.extract.pack.v1"`
- **Dossier Pack**: `schemaVersion === 2`

---

## 5. Known Limitations (v1)

1. **No cloud sync**: Local-first only
2. **Text-only input**: No PDF/URL parsing
3. **Heuristic-only**: No LLM-based extraction
4. **Browser storage**: Data loss risk if cache cleared (mitigated by JSON export)

---

**Next Step**: Complete Post-v1 Hardening (UX Polish + Verification Gates)
