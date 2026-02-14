# M2 Summary: Heuristic Reliability (Consolidation)

**Scope:** M2 (Heuristic Reliability)
**Date:** January 21, 2026
**Status:** COMPLETE (Ready for Productization)

## Certified Components

The following heuristic engines are now certified as **deterministic, rule-based, and provenance-enforced**:

1.  **Sentence Segmentation (`M2.1`)**
    *   Rule-based splitting with abbreviation whitelist (titles, commercial, geography).
    *   Protected constructs: Decimals, currency, parentheses, quotes.
    *   Zero-mutation offsets.

2.  **Entity Extraction & Tiering (`M2.2`)**
    *   Segment-based extraction (prevents cross-sentence merging).
    *   Canonicalization (whitespace, punctuation trimming, suffix normalization).
    *   Tiering (PRIMARY/SECONDARY/NOISE) based on patterns, suffixes, and repetition.
    *   Stable ID generation (hash of canonical text + offsets).

3.  **Metric Normalization (`M2.3`)**
    *   **Status:** Certified (Schema + Rules), Integration Pending (M3).
    *   Schema defined for scalar and range values.
    *   Unresolved status handling defined for ambiguous units.
    *   *Note: Full runtime wiring into the extraction loop is an M3 task.*

4.  **Provenance Tightening (`M2.4`)**
    *   Strict enforcement of `NO OFFSET, NO ITEM`.
    *   Validation of finite bounds, logical order, and content integrity.
    *   Expanded sentence context in provenance object.

## Hard Invariants

These invariants are strictly enforced in the codebase. Violations result in item discard or transaction rejection.

*   **A) Determinism:** Same input text + same options → Exact same Output JSON (Artifacts, IDs, Offsets). Verified via 5-run stability tests.
*   **B) No Offset, No Item:** Any extracted item with missing, invalid, or negative offsets is silently discarded during validation.
*   **C) Offsets are Document-Absolute:** All offsets reference the original source string indices (0 to N).
*   **D) Stable IDs:** IDs are deterministic hashes derived strictly from `content + start_offset + end_offset`. UUIDs/Randomness are PROHIBITED.
*   **E) Binary Import Policy:** On `pack_id` collision during import, the policy is **SKIP** (preserve existing). No field-level merging.
*   **F) No Guessing:** Ambiguous metrics or entities are marked `UNRESOLVED` or `NOISE`, not guessed. (Enforced by Tiering logic for Entities; Defined by Schema rules for Metrics).

## Discard Taxonomy

| Reason | Enforced By | Example | Action |
| :--- | :--- | :--- | :--- |
| **Invalid Offsets** | `validateProvenance` | `start: -1`, `end: 5` | **DISCARD** (Counted in stats) |
| **Content Mismatch** | `validateProvenance` | Text at offset `"Pear"` != Item `"Apple"` | **DISCARD** |
| **Cross-Boundary** | `validateProvenance` | `start > end` | **DISCARD** |
| **Noise Entity** | `tierEntities` | Single occurrence of "However" (Sentence Initial) | **EXCLUDE** (Tier=NOISE, included=false) |
| **Ambiguous Unit** | `MetricNormalizer` (Schema) | `5m` (Minutes vs Million) | **MARK UNRESOLVED** (Keep item, status=unresolved) |

## Operational Proof

### Verification Commands
```bash
# 1. Segmenter Regression
npx tsx client/src/scripts/test-segmenter.ts

# 2. Unit Test Suite (Dedupe, Entities, Provenance)
npx vitest run client/src/lib/tests/unit/

# 3. Provenance Stats
npx tsx client/src/scripts/test-provenance.ts
```

### Verification Output (Snapshot)
```
=== RUNNING SENTENCE SEGMENTER TESTS ===
Unit Tests: 10/10 passed.
=== FIXTURE REGRESSION METRICS ===
Total Fixtures: 5, Total Segments: 18, Short Segments: 0

 RUN  v4.0.17 /home/runner/workspace/client
 ✓ src/lib/tests/unit/importDedupe.test.ts (2 tests)
 ✓ src/lib/tests/unit/provenance.test.ts (4 tests)
 ✓ src/lib/tests/unit/entityExtractor.test.ts (10 tests)
 Test Files  3 passed (3)
 Tests  16 passed (16)

=== PROVENANCE REGRESSION METRICS ===
Total Items Extracted: 24
Discarded (Invalid/No Offset): 0
Items with Invalid Offsets in Output: 0
```

## Known Limitations

*   **Metric Normalization Wiring:** The `MetricNormalizer` schema is defined (`client/src/lib/heuristics/metrics/metricNormalizer.ts`), but the regex-based extractor in `lanternExtract.ts` is still used for the prototype. Full integration is a Productization task.
*   **Complex Cross-Sentence Entities:** Entities spanning sentence boundaries (extremely rare in well-formed text) are split by the segmenter enforcement.
*   **Internationalization:** Heuristics are currently tuned for English (suffixes, abbreviations, months).

## Next Milestone Boundary

**M2 is COMPLETE.**
All heuristic foundations are laid. No further heuristic research is required.
The project is ready for **Productization (M3)**, focusing on UI refinement, bulk processing, and export workflows.
