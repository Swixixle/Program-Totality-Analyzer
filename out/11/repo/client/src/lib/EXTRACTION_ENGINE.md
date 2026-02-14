# Lantern Extraction Engine (v0.1.5)

## Architecture Summary
The Lantern Extraction Engine is a deterministic, heuristic-based NLP pipeline designed for high-integrity knowledge extraction from raw text. It operates purely on the frontend (client-side) to ensure privacy and speed.

### Core Components
1.  **Sentence Segmenter**: Splits text into addressable spans with offset tracking.
2.  **Entity Extractor**: Regex-based recognition of Organizations, Persons, and Locations using capitalization and suffix heuristics.
3.  **Quote Extractor**: Pattern matching for direct speech with "Forward Scan" attribution logic (bounded to 1 sentence).
4.  **Metric Extractor**: Context-aware parsing of Scalars, Ranges, Ratios, and Rates, normalizing units and values.
5.  **Timeline Extractor**: Explicit date parsing and relative date resolution (partial).
6.  **Canonicalizer**: Deterministic identity generation for deduplication and persistence.

## Invariants
1.  **Provenance Integrity**: Every extracted item MUST map to a character span in the source text (`text.slice(start, end) === item.text`). Items failing this are dropped.
2.  **Determinism**: Given the same input text and mode, the engine MUST produce bit-for-bit identical output JSON.
3.  **Stable Identity**:
    *   `stable_source_hash`: SHA256 of raw source text.
    *   `pack_id`: SHA256 of the canonicalized artifact (Source + Engine + Items + Curation).

## Extraction Modes
*   **Conservative**: High precision, lower recall. Requires strict validation (e.g., attribution verbs, explicit metric units).
*   **Balanced**: Default mode. Standard heuristics.
*   **Broad**: High recall, lower precision. Loosens constraints (e.g., allows capitalized phrases without known suffixes as entities).

## Testing & Quality
Run the **Quality Dashboard** in the UI to verify:
*   Precision/Recall/F1 against golden fixtures.
*   Cross-mode monotonicity (Conservative should not be noisier than Broad).
*   Determinism checks.
