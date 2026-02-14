# Lantern Changelog

All notable changes to the Lantern investigative intelligence platform.

## [1.0.0] - 2026-01-22

### Complete Feature Set (M1-M12)

#### M1: Pack Schema & Storage
- Implemented Pack v2 schema with entities, edges, claims, evidence
- IndexedDB persistence layer with debounced saves
- WHY: Foundation for all data operations

#### M2: Dossier Editor
- Full CRUD for entities, edges, claims, evidence
- Entity combobox with search
- Relationship graph visualization
- WHY: Core data curation interface

#### M3: Heuristic Analysis Engine
- Influence Hubs (degree centrality)
- Funding Gravity (monetary flow analysis)
- Enforcement Map (coercive edge detection)
- WHY: Shadow-Caste pattern detection

#### M4: Evidence Density Thresholds
- Minimum evidence count gating per heuristic
- "Insufficient Data" status propagation
- WHY: Epistemic safety - prevent analysis on sparse data

#### M5: Report Generation
- Structured report view with all findings
- Section layout: title, explanation, content, receipt
- WHY: Publication-ready artifact generation

#### M6: Markdown Export
- Full report export with YAML frontmatter
- Table escaping and formatting
- WHY: Portable, version-controllable output

#### M7: Interpretation Limits & Disclaimers
- Callout blocks explaining heuristic assumptions
- "What This Does NOT Prove" sections
- WHY: Epistemic safety - prevent misinterpretation

#### M8: Migration Transparency
- Schema version tracking
- Migration notes in reports
- WHY: Audit trail for data transformations

#### M9: Print Layout
- Print-optimized CSS
- Hidden navigation in print mode
- WHY: Physical distribution capability

#### M10: Claim Scope Tracking
- claimType and claimScope fields
- utterance vs content attribution
- WHY: Precision in attribution claims

#### M11: Robustness & Sensitivity Checks
- Single-point failure testing
- Stability classification per finding
- WHY: Confidence in finding durability

#### M12: Comparison Integrity
- SHA-256 fingerprints for reports
- Cross-dossier comparison binding
- Tamper-evidence for comparisons
- WHY: Cryptographic audit trail

### Bug Fixes

#### lantern-extract.tsx Corruption (2026-01-22)
- SYMPTOM: Imports inside function body, duplicate code blocks
- CAUSE: Accidental paste/merge corruption
- FIX: Normalized imports to top-level, removed duplicates, restored handlers
- FILES: client/src/pages/lantern-extract.tsx
- VERIFICATION: Build pass, manual testing

#### Type Guard Upgrade (2026-01-22)
- OLD: `"pack_id" in p` structural check
- NEW: `isExtractPack(p)` / `isDossierPack(p)` with schema literals
- FILES: client/src/lib/storage.ts, client/src/pages/lantern-extract.tsx
- WHY: Future-proof discriminated union handling

---

## Post-v1 Hardening - Completed 2026-01-22

### Technical Hardening
- [x] Type guards (isExtractPack, isDossierPack) - with v1/v2 compatibility
- [x] Migration logic enhanced for v1→v2 field transformations
- [x] Fingerprint determinism verified

### UX Polish
- [x] Report view: print CSS, interpretation limits callout
- [x] Comparison view: stats cards, match badges
- [x] Editor view: claimScope selector with helper text

### Verification
- [x] 57/57 tests passing (including v1 pack acceptance tests)
- [x] Build successful
- [x] No LSP errors

---

## Route Identity Fix - 2026-01-22

### Changed
- Root route (`/`) now shows **Library** page (investigative Lantern entrypoint)
- Legacy "Sovereignty" dashboard moved to `/legacy`
- Quick nav updated: Library, Extract, Compare

### Added
- `client/src/pages/library.tsx` - New landing page with:
  - Extract packs section (schema: lantern.extract.pack.v1)
  - Dossier packs section (schemaVersion: 2)
  - Quick actions: New Extract, Compare Dossiers
  - Stats and timestamps for each pack

### Why
Screenshots showed wrong product identity ("Sovereignty Navigation System" instead of investigative Lantern).
User must see the correct investigative workflow on landing.
