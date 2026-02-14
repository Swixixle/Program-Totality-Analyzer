import { z } from "zod";
import { segmentSentences, type Segment } from "./heuristics/segmenters/sentenceSegmenter";
import { extractEntities, type ExtractedEntity } from "./heuristics/entities/entityExtractor";
import { sanitizeEntities, computePackConfidence, type SanitizedEntity, type EntityClass } from "./heuristics/entities/entitySanitizer";

// --- TYPES ---

export type Provenance = {
  start: number;
  end: number;
  sentence: string; // Legacy/Display
  sentence_text: string;
  sentence_start: number;
  sentence_end: number;
};

export type BaseItem = {
  id: string;
  provenance: Provenance;
  confidence: number;
  included: boolean;
};

export type EntityItem = BaseItem & {
  text: string;
  type: "Person" | "Organization" | "Location" | "Event" | "Product";
  canonical_family_id?: string;
  canonical_id?: string;
  entity_class?: EntityClass;
  confidence_score?: number;
};

export type QuoteItem = BaseItem & {
  quote: string;
  speaker: string | null;
  speaker_candidates?: string[];
};

export type MetricItem = BaseItem & {
  value: string;
  unit: string;
  metric_kind: "scalar" | "range" | "ratio" | "rate";
  range_low?: number;
  range_high?: number;
  normalized_value?: number;
  qualifier?: string;
  parse_notes?: string;
};

export type TimelineItem = BaseItem & {
  date: string;
  date_type: "explicit" | "relative";
  event: string;
};

export type EngineStats = {
  duplicates_collapsed: number;
  invalid_dropped: number;
  headlines_suppressed: number;
  sanitation_denied: number;
  sanitation_reclassified: number;
  sanitation_collapsed: number;
};

export type TrustMetadata = {
  schema_version: string;
  confidence_model: string;
  sanitation_pass: boolean;
  pack_confidence: number;
  confidence_threshold: number;
};

export const LanternPackSchema = z.object({
  pack_id: z.string(),
  schema: z.literal("lantern.extract.pack.v1"),
  hashes: z.object({
      source_text_sha256: z.string(),
      pack_sha256: z.string()
  }),
  engine: z.any(),
  source: z.any(),
  items: z.any(),
  stats: z.any(),
  trust: z.any().optional()
});

export const AnyPackSchema = z.discriminatedUnion("schema", [
  LanternPackSchema,
]);

export type LanternPack = {
  pack_id: string;
  schema: "lantern.extract.pack.v1";
  hashes: { source_text_sha256: string; pack_sha256: string };
  engine: { name: string; version: string };
  source: { title: string; author: string; publisher: string; url: string; published_at: string; source_type: string; retrieved_at: string };
  items: { entities: EntityItem[]; quotes: QuoteItem[]; metrics: MetricItem[]; timeline: TimelineItem[] };
  stats: EngineStats;
  trust?: TrustMetadata;
};

export type ExtractionOptions = {
  mode: "conservative" | "balanced" | "broad";
};

// --- HELPERS ---

export const mockHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
};

export const computePackId = (pack: Omit<LanternPack, "pack_id" | "hashes"> | any, sourceHash: string): string => {
  // Deterministic ID based on content
  const content = JSON.stringify({
    source: pack.source,
    engine: pack.engine,
    items: pack.items
  });
  return mockHash(content + sourceHash);
};

export const normalizeForScore = (val: string | number | undefined): string => {
  if (val === undefined || val === null) return "null"; 
  return String(val)
    .trim()
    .replace(/\s+/g, " ") 
    .replace(/[–—]/g, "-") 
    .replace(/,/g, "") 
    .toLowerCase();
};

export const createItemKey = (item: any, type: "entities" | "quotes" | "metrics" | "timeline"): string => {
  if (type === "entities") {
    return `entity|${item.type}|${normalizeForScore(item.text)}`;
  }
  if (type === "quotes") {
    return `quote|${normalizeForScore(item.quote)}|${normalizeForScore(item.speaker)}`;
  }
  if (type === "metrics") {
    const core = `metric|${item.metric_kind}|${normalizeForScore(item.unit)}`;
    if (item.metric_kind === "range") {
      return `${core}|${normalizeForScore(item.range_low)}|${normalizeForScore(item.range_high)}`;
    }
    const valKey = item.normalized_value !== undefined ? item.normalized_value : item.value;
    return `${core}|${normalizeForScore(valKey)}`;
  }
  if (type === "timeline") {
    return `time|${item.date_type}|${normalizeForScore(item.date)}`;
  }
  return item.id;
};

// --- EXTRACTION LOGIC (MOCK) ---

export const extract = (text: string, options: ExtractionOptions): { items: LanternPack["items"], stats: EngineStats, stable_source_hash: string, trust: TrustMetadata } => {
  const stable_source_hash = mockHash(text);
  const items: LanternPack["items"] = {
    entities: [],
    quotes: [],
    metrics: [],
    timeline: []
  };
  const stats: EngineStats = {
    duplicates_collapsed: 0,
    invalid_dropped: 0,
    headlines_suppressed: 0,
    sanitation_denied: 0,
    sanitation_reclassified: 0,
    sanitation_collapsed: 0
  };
  const CONFIDENCE_THRESHOLD = 0.5;

  const defaultTrust: TrustMetadata = {
    schema_version: "lantern.extract.pack.v1",
    confidence_model: "span_length+ontology_match+canonical_frequency",
    sanitation_pass: true,
    pack_confidence: 0,
    confidence_threshold: CONFIDENCE_THRESHOLD
  };

  if (!text) return { items, stats, stable_source_hash, trust: defaultTrust };

  // 1. Segment Sentences (M2 Priority #1)
  const segments = segmentSentences(text);
  
  // Validation Helper (M2.4 Provenance Tightening)
  const validateProvenance = (start: number, end: number, matchText: string): Provenance | null => {
      // 1. Finite Number Check
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

      // 2. Bounds Check
      if (start < 0 || end > text.length) return null;

      // 3. Logical Order Check
      if (start >= end) return null;

      // 4. Content Integrity Check (No Repair)
      if (text.slice(start, end) !== matchText) return null;

      // 5. Sentence Context
      const segment = segments.find(s => s.start <= start && s.end >= end);
      
      if (segment) {
          return {
              start,
              end,
              sentence: segment.text,
              sentence_text: segment.text,
              sentence_start: segment.start,
              sentence_end: segment.end
          };
      }
      
      // Fallback: Cross-sentence match
      const covering = segments.filter(s => s.end > start && s.start < end);
      if (covering.length > 0) {
           const first = covering[0];
           const last = covering[covering.length - 1];
           const combinedText = text.slice(first.start, last.end); 
           return {
               start,
               end,
               sentence: combinedText,
               sentence_text: combinedText,
               sentence_start: first.start,
               sentence_end: last.end
           };
      }

      return null;
  };

  // --- ENTITIES (Integrated M2.2 & M2.4 + Sanitation) ---
  // Step 1: Extract raw entities per segment
  const rawExtractedEntities: ExtractedEntity[] = [];
  segments.forEach(segment => {
      const segmentEntities = extractEntities(segment.text);
      segmentEntities.forEach(e => {
          const absStart = segment.start + e.start;
          const absEnd = segment.start + e.end;
          rawExtractedEntities.push({
              ...e,
              start: absStart,
              end: absEnd
          });
      });
  });

  // Step 2: Apply sanitation pass (denylist, classification, confidence, dedupe)
  const sanitizationResult = sanitizeEntities(rawExtractedEntities);
  stats.sanitation_denied = sanitizationResult.stats.denied_count;
  stats.sanitation_reclassified = sanitizationResult.stats.reclassified_count;
  stats.sanitation_collapsed = sanitizationResult.stats.collapsed_count;

  // Step 3: Convert sanitized entities to EntityItem format
  sanitizationResult.entities.forEach(e => {
      const provenance = validateProvenance(e.start, e.end, e.text);
      if (!provenance) {
          stats.invalid_dropped++;
          return;
      }

      const stableId = mockHash(`${e.canonical}:${e.start}:${e.end}`);
      const entityType = (e.entity_class === "Person" || e.entity_class === "Location" || 
                         e.entity_class === "Organization" || e.entity_class === "Event" || 
                         e.entity_class === "Product") ? e.entity_class : "Organization";
      
      items.entities.push({
          id: stableId,
          provenance,
          confidence: e.confidence_score,
          included: e.tier !== "NOISE" && e.confidence_score >= CONFIDENCE_THRESHOLD,
          text: e.text,
          type: entityType,
          canonical_family_id: e.entity_id,
          canonical_id: e.canonical_id,
          entity_class: e.entity_class,
          confidence_score: e.confidence_score
      });
  });

  // Step 4: Add reclassified timeline items from sanitation
  sanitizationResult.reclassified_timeline.forEach(t => {
      const stableId = mockHash(`time:reclassified:${t.date}:${t.event}`);
      items.timeline.push({
          id: stableId,
          provenance: {
              start: 0,
              end: 0,
              sentence: t.source_entity,
              sentence_text: t.source_entity,
              sentence_start: 0,
              sentence_end: 0
          },
          confidence: 0.7,
          included: true,
          date: t.date,
          date_type: t.date_type,
          event: t.event
      });
  });

  // Quotes ("...")
  const quoteRegex = /"([^"]+)"/g;
  let match; 
  while ((match = quoteRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;
      
      const start = match.index;
      const end = start + match[0].length;
      const quoteBody = match[1];
      const rawText = match[0];
      
      const provenance = validateProvenance(start, end, rawText);
      if (!provenance) {
          stats.invalid_dropped++;
          continue;
      }
      
      // Stable ID
      const stableId = mockHash(`quote:${start}:${end}`);
      
      items.quotes.push({
          id: stableId,
          provenance,
          confidence: 0.85,
          included: true,
          quote: quoteBody,
          speaker: null,
      });
  }

  // Metrics (Numbers + Units)
  // Updated for Provenance Tightening (M2.4)
  const metricRegex = /(\d+(?:,\d{3})*(?:\.\d+)?)\s?(million|billion|trillion|%|USD|EUR|items|users)/gi;
  while ((match = metricRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;

      const start = match.index;
      const end = start + match[0].length;
      const value = match[1];
      const unit = match[2];
      const rawText = match[0];

      const provenance = validateProvenance(start, end, rawText);
      if (!provenance) {
          stats.invalid_dropped++;
          continue;
      }
      
      // Normalization (Basic)
      const normValue = parseFloat(value.replace(/,/g, ""));
      
      // Stable ID: Value + Unit + Offsets
      const stableId = mockHash(`metric:${rawText}:${start}:${end}`);

      items.metrics.push({
          id: stableId,
          provenance,
          confidence: 0.95,
          included: true,
          value: value,
          unit: unit,
          metric_kind: "scalar",
          normalized_value: normValue
      });
  }

  // Timeline (Dates)
  const dateRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2},?\s\d{4}/g;
  while ((match = dateRegex.exec(text)) !== null) {
      if (match.index === undefined) continue;

      const start = match.index;
      const end = start + match[0].length;
      const rawText = match[0];
      
      const provenance = validateProvenance(start, end, rawText);
      if (!provenance) {
          stats.invalid_dropped++;
          continue;
      }

      const stableId = mockHash(`time:${match[0]}:${start}:${end}`);

      items.timeline.push({
          id: stableId,
          provenance,
          confidence: 0.9,
          included: true,
          date: match[0],
          date_type: "explicit",
          event: "Event inferred from context"
      });
  }

  // Simple dedupe mock - UPDATED for M2.4 (Provenance)
  // We DO NOT collapse entities by text anymore. We only collapse if IDs match (exact same provenance).
  // Stable ID includes offsets, so this maps duplicates only if they are the exact same artifact.
  // This effectively disables collapsing of different mentions, preserving all occurrences.
  const uniqueItems = new Map();
  const allItems = [...items.entities, ...items.quotes, ...items.metrics, ...items.timeline];
  
  // Actually, we should dedupe per list to preserve types
  const dedupeList = (list: any[]) => {
      const map = new Map();
      list.forEach(i => {
         if (!map.has(i.id)) map.set(i.id, i);
         else stats.duplicates_collapsed++;
      });
      return Array.from(map.values());
  };

  items.entities = dedupeList(items.entities);
  items.quotes = dedupeList(items.quotes);
  items.metrics = dedupeList(items.metrics);
  items.timeline = dedupeList(items.timeline);

  // Compute pack confidence from sanitized entities
  const packConfidence = computePackConfidence(sanitizationResult.entities);

  const trust: TrustMetadata = {
    schema_version: "lantern.extract.pack.v1",
    confidence_model: "span_length+ontology_match+canonical_frequency",
    sanitation_pass: true,
    pack_confidence: packConfidence,
    confidence_threshold: CONFIDENCE_THRESHOLD
  };

  return { items, stats, stable_source_hash, trust };
};

// --- QUALITY SCORING ---

export type QualityReport = {
  fixture_id: string;
  score: number;
  metrics: {
    precision: number;
    recall: number;
    f1: number;
  };
  details: {
    expected: number;
    actual: number;
    matches: number;
    false_positives: number;
    false_negatives: number;
  };
  failures: string[];
};

export const scoreExtraction = (
  actualItems: any[],
  expectedItems: any[],
  matchFn: (a: any, b: any) => boolean
): QualityReport["details"] & { metrics: QualityReport["metrics"] } => {
  let matches = 0;
  for (const expected of expectedItems) {
    if (actualItems.some(actual => matchFn(actual, expected))) {
      matches++;
    }
  }
  let validActuals = 0;
  for (const actual of actualItems) {
    if (expectedItems.some(expected => matchFn(actual, expected))) {
      validActuals++;
    }
  }

  const false_negatives = expectedItems.length - matches;
  const false_positives = actualItems.length - validActuals;

  const precision = actualItems.length > 0 ? validActuals / actualItems.length : 1;
  const recall = expectedItems.length > 0 ? matches / expectedItems.length : 1;
  const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return {
    expected: expectedItems.length,
    actual: actualItems.length,
    matches,
    false_positives,
    false_negatives,
    metrics: { precision, recall, f1 }
  };
};

// --- DIFF LOGIC ---

export type PackDiff = {
  added: { type: string, item: any }[];
  removed: { type: string, item: any }[];
  changed: { type: string, from: any, to: any }[]; 
  common: { type: string, item: any }[];
  stats: {
    added_count: number;
    removed_count: number;
    changed_count: number;
    common_count: number;
  }
};

export const diffPacks = (packA: LanternPack, packB: LanternPack): PackDiff => {
  const diff: PackDiff = {
    added: [],
    removed: [],
    changed: [],
    common: [],
    stats: { added_count: 0, removed_count: 0, changed_count: 0, common_count: 0 }
  };

  const types = ["entities", "quotes", "metrics", "timeline"] as const;

  types.forEach(type => {
    const mapA = new Map();
    packA.items[type].forEach((i: any) => mapA.set(createItemKey(i, type), i));
    
    const mapB = new Map();
    packB.items[type].forEach((i: any) => mapB.set(createItemKey(i, type), i));

    for (const [key, itemA] of mapA) {
      if (mapB.has(key)) {
        const itemB = mapB.get(key);
        const contentA = JSON.stringify({ ...itemA, id: null });
        const contentB = JSON.stringify({ ...itemB, id: null });
        
        if (contentA === contentB) {
            diff.common.push({ type, item: itemA });
        } else {
            diff.changed.push({ type, from: itemB, to: itemA });
        }
      } else {
        diff.added.push({ type, item: itemA });
      }
    }

    for (const [key, itemB] of mapB) {
      if (!mapA.has(key)) {
        diff.removed.push({ type, item: itemB });
      }
    }
  });

  diff.stats.added_count = diff.added.length;
  diff.stats.removed_count = diff.removed.length;
  diff.stats.changed_count = diff.changed.length;
  diff.stats.common_count = diff.common.length;

  return diff;
};
