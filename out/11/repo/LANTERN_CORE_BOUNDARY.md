# Lantern Core Boundary

**Definition:**
"Lantern Core" is the portable, rule-based extraction engine within the application. It MUST be separable from the UI, storage layer, and React framework. It operates purely on string inputs and returns JSON outputs.

## Core File Manifest

The following files constitute the "Lantern Core" and must remain dependency-free (except for internal helpers):

### 1. Heuristics (The Brain)
*   `client/src/lib/heuristics/segmenters/sentenceSegmenter.ts` (Segmentation Rules)
*   `client/src/lib/heuristics/entities/entityExtractor.ts` (Extraction Logic)
*   `client/src/lib/heuristics/entities/entityCanonicalizer.ts` (Normalization)
*   `client/src/lib/heuristics/entities/entityTierer.ts` (Classification)
*   `client/src/lib/heuristics/metrics/metricNormalizer.ts` (Schema & Types)

### 2. Validation (The Guard)
*   `client/src/lib/lanternExtract.ts` (Orchestrator & Provenance Validation)
    *   *Note: Currently contains some orchestration logic that should ideally be split in M3, but `validateProvenance` and `extract` are the core functions.*

### 3. Helpers
*   `client/src/lib/lanternExtract.ts` (Exported helper: `mockHash`)

## Core I/O Contract

### Input
```typescript
type ExtractionOptions = {
  mode: "conservative" | "balanced" | "broad";
};

// Function Signature
function extract(text: string, options: ExtractionOptions): LanternPackResult;
```

### Output
```typescript
type LanternPackResult = {
  items: {
    entities: EntityItem[];
    quotes: QuoteItem[];
    metrics: MetricItem[];
    timeline: TimelineItem[];
  };
  stats: EngineStats;
  stable_source_hash: string;
};
```

### Artifact Shapes

**1. Entity (Mandatory)**
```typescript
type EntityItem = {
  id: string; // Stable Hash
  provenance: {
    start: number;
    end: number;
    sentence: string; // Legacy
    sentence_text: string;
    sentence_start: number;
    sentence_end: number;
  };
  text: string; // Raw substring
  canonical_family_id: string; // Hash of canonical text
  confidence: number;
  included: boolean;
  type: "Organization" | "Person" | "Location" | "Event" | "Product";
  // M3 Target: canonical_text (string), tier (enum) explicitly exposed
};
```

**2. Metric (Mandatory)**
```typescript
type MetricItem = {
  id: string;
  provenance: { /* same as above */ };
  value: string; // Raw value string
  unit: string;  // Raw unit string
  metric_kind: "scalar" | "range" | "ratio" | "rate";
  normalized_value?: number; // Best-effort scalar
  // M3 Target: Full NormalizedMetric schema with min/max/currency
};
```

**3. Segment (M3 Target / Internal Only Today)**
```typescript
type Segment = {
  start: number;
  end: number;
  text: string;
};
```

## Prohibited Dependencies in Core

The Core module **MUST NOT** import or use:
*   `react` / `jsx` / `tsx` (UI components)
*   `@/components/ui/*` (Shadcn/UI)
*   `window` / `document` / `localStorage` (Browser APIs)
    *   *Exception: `lanternExtract.ts` currently runs in browser, but logic should be isomorphic.*
*   `replit` specific environment variables (unless injected via config)
*   Network calls (`fetch`, `axios`) inside extraction logic (Extraction is offline/local).

## Future Architectural Goal
Isolate `client/src/lib/lanternExtract.ts` and `client/src/lib/heuristics/` into a separate package or strict module to enforce this boundary physically.
