# Lantern Library Storage Schema

## Storage Mechanism
Lantern uses `localStorage` for the v0.1.5 prototype.

**Key**: `lantern_packs`
**Value**: JSON Array of `LanternPack` objects.

## Key Schema
Each `LanternPack` contains:
*   `pack_id`: Unique identifier (SHA256 of canonical content).
*   `hashes`:
    *   `source_text_sha256`: ID of the input text.
    *   `pack_sha256`: Redundant ID check.
*   `source`: Metadata (Title, Author, URL, Retrieved At).
*   `engine`: Version and Name.
*   `items`: Arrays of Entities, Quotes, Metrics, Timeline.
*   `stats`: Execution statistics.

## Snapshot Semantics
*   **Immutable Snapshots**: A pack is defined by its content. If you change curation (toggle an item include/exclude), the content changes, resulting in a **new `pack_id`**.
*   **No Overwrites**: Saving a pack with a new ID appends it to the library. Saving a pack with an existing ID is a no-op (idempotent).
*   **Source Grouping**: Packs are grouped in the UI by `stable_source_hash` to show the history of extractions for a single document.

## Canonicalization Exclusions
To ensure stable hashing, the following are **excluded** from the `pack_id` calculation:
*   UI-only state (e.g., `showDetails` flags).
*   Runtime timestamps (except extraction timestamp if part of metadata).
*   Order of keys in JSON objects (strictly sorted before hashing).
*   Order of items in arrays (strictly sorted by Item ID before hashing).
