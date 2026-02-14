# LANTERN SYSTEM SNAPSHOT

Portable reference document for external review.
Generated: 2026-01-22

---

## A. What This System Is

Lantern is an evidentiary record system for investigative analysis. It allows analysts to extract structured data from unstructured text, curate dossiers of entities and relationships, apply bounded heuristics to detect structural patterns, and generate publication-ready reports with cryptographic integrity verification. All analysis requires human-in-the-loop curation. The system does not issue verdicts. Outputs are designed to withstand legal and journalistic scrutiny by emphasizing traceability over persuasion.

---

## B. What This System Is NOT

- **Not generative truth**: Lantern does not generate facts or conclusions.
- **Not predictive**: Lantern does not forecast outcomes or behaviors.
- **Not a recommender**: Lantern does not suggest actions or next steps.
- **Not verdict-issuing**: Lantern does not determine guilt, innocence, intent, or truth.
- **Not autonomous**: All dossier content is human-curated. Heuristics produce conditional findings, not conclusions.

---

## C. Core Objects & Schemas

### Extract Pack
- **Schema discriminator**: `schema: "lantern.extract.pack.v1"`
- **Contents**: Entities, quotes, metrics, timeline events extracted from source text
- **Provenance**: All items include character offsets to original source

### Dossier Pack (v2)
- **Schema discriminator**: `schemaVersion: 2`, presence of `packId`, absence of extract schema
- **Contents**: Curated entities, edges (relationships), claims, evidence links
- **Migration**: v1 packs auto-migrate on load; transformations logged

### Report Snapshot
- **Contents**: Frozen dossier state plus heuristic outputs
- **Integrity**: SHA-256 fingerprint of canonical data
- **Export format**: Markdown with YAML frontmatter

### Comparison Report
- **Contents**: Structural alignment of two dossiers
- **Integrity**: Fingerprint A + Fingerprint B + comparison timestamp → comparison fingerprint
- **Sufficiency**: Both packs must meet evidence thresholds independently

---

## D. System Flow (Stepwise)

1. **Upload**: User provides source text (article, document, transcript)
2. **Extract**: System extracts entities, quotes, metrics, timeline events with character offsets
3. **Promote**: User promotes Extract Pack to Dossier Pack for curation
4. **Curate**: User adds/edits entities, edges, claims, and evidence
5. **Analyze**: Report view applies heuristics to dossier data
6. **Report**: Structured report generated with findings, limits, interpretation disclaimers
7. **Export**: Markdown export with integrity fingerprint for external use

---

## E. Heuristic Lenses

### Influence Hubs
- **Measures**: Degree centrality — which entities have the most relationship edges
- **Minimum threshold**: 3 edges
- **Insufficient data behavior**: Returns "Insufficient Data" status; no findings produced

### Funding Gravity
- **Measures**: Concentration and flow of monetary edges (funded_by, donated_to, grant_from, etc.)
- **Minimum threshold**: 2 funding edges
- **Insufficient data behavior**: Returns "Insufficient Data" status; no findings produced

### Enforcement Map
- **Measures**: Presence of coercive edges (censored_by, banned_by, sued_by, fired_by, etc.)
- **Minimum threshold**: 1 enforcement edge
- **Insufficient data behavior**: Returns "No Enforcement Edges Detected"

### Sensitivity / Robustness
- **Measures**: Whether findings survive removal of any single entity or edge
- **Minimum threshold**: 2 data points for meaningful simulation
- **Output classifications**: ROBUST, FRAGILE, SINGLE_POINT
- **Insufficient data behavior**: Section omitted from report

---

## F. Safety & Epistemic Controls

### Claim Scope
- **Utterance**: "X said Y" — records that X made this statement
- **Content**: "Y is true" — records an assertion about Y itself
- User must select scope when recording claims to prevent conflation

### Migration Logs
- All schema transformations recorded in `pack.migrationLog[]`
- Includes ISO timestamp and description of each change
- Displayed in reports for audit

### Interpretation Limits
- Every report includes explicit disclaimers about what findings do NOT imply
- Heuristic outputs are conditional on recorded data only

### Evidence Density Thresholds
- Each heuristic has a minimum edge count before analysis proceeds
- System refuses to produce findings below threshold
- Refusal is correct behavior, not failure

---

## G. Integrity & Auditability

### Report Fingerprinting
- **Algorithm**: SHA-256
- **Input**: Canonical JSON of dossier data (sorted keys, sorted arrays)
- **Purpose**: Tamper-evidence for the exact state analyzed

### Comparison Fingerprinting
- **Method**: Hash(Fingerprint A + Fingerprint B + timestamp)
- **Purpose**: Cryptographically binds two dossiers at comparison time

### Non-Auto-Updating Snapshots
- Reports and comparisons are frozen at generation time
- Changes to underlying dossier do not update existing reports
- Each report is a point-in-time audit record

### Legal and Journalistic Relevance
- Fingerprints allow independent verification of analyzed data
- Chain of custody can be established via export + fingerprint
- Supports FOIA responses, legal discovery, editorial review

---

## H. Intended Use Cases

- **Investigative journalism**: Mapping relationships between actors across source materials
- **Legal review**: Structuring evidence and claims with traceable provenance
- **Historical analysis**: Recording documented relationships and events without inference
- **Adversarial inquiry**: Testing claims against evidence with explicit sufficiency checks

---

## Visual Surfaces (Referenced)

| Surface | Purpose |
|---------|---------|
| Library View | Landing page. Lists all Extract Packs and Dossier Packs. Entry point. |
| Extract View | Text input. Produces Extract Packs from source text. |
| Dossier Editor | CRUD interface for entities, edges, claims, evidence. |
| Report View | Read-only analysis output with heuristics, limits, fingerprint. |
| Comparison View | Cross-dossier structural alignment with dual fingerprint binding. |
| Reference View | "How Lantern Works" documentation (method, limits, safeguards). |

---

*End of snapshot.*
