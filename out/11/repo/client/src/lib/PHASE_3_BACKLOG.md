# Phase 3 Backlog (Lantern)

The following features are explicitly **out of scope** for the v0.1.5 Baseline Freeze. They are parked here for future implementation.

## Persistence & Backend
*   [ ] **SQLite/Postgres Integration**: Migrate from `localStorage` to a real backend database.
*   [ ] **API Layer**: REST endpoints for saving/loading packs.
*   [ ] **Multi-User Support**: User accounts and shared libraries.

## Advanced Extraction
*   [ ] **Shadow NLP Engine**: Integrate LLM (Gemini/GPT) as a shadow extractor to propose items missed by heuristics.
*   [ ] **Advanced Disambiguation**: Cross-document entity linking and resolution.
*   [ ] **Graph Mapping**: Relationship extraction between entities (Subject-Verb-Object).

## Workflow Tools
*   [ ] **Multi-Source Corpora**: Upload and process multiple documents at once.
*   [ ] **Pack Merging**: Tools to merge two different extractions of the same source.
*   [ ] **Batch Exports**: Export multiple packs to CSV/JSON-L.
*   [ ] **Citation Generator**: Auto-generate citations from extraction provenance.
