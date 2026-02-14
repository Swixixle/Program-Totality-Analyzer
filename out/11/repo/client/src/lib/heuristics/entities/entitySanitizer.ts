import type { ExtractedEntity } from "./entityExtractor";
import { mockHash } from "../../lanternExtract";

export type EntityClass = "Person" | "Organization" | "Location" | "Event" | "Product" | "DocumentSection" | "EXCLUDED";

export type SanitizedEntity = ExtractedEntity & {
  entity_class: EntityClass;
  confidence_score: number;
  exclusion_reason?: string;
  canonical_id: string;
};

export type ReclassifiedItem = {
  type: "timeline";
  date: string;
  date_type: "explicit" | "relative";
  event: string;
  source_entity: string;
};

export type SanitizationResult = {
  entities: SanitizedEntity[];
  reclassified_timeline: ReclassifiedItem[];
  stats: {
    input_count: number;
    output_count: number;
    denied_count: number;
    reclassified_count: number;
    collapsed_count: number;
  };
};

const ORGANIZATION_DENYLIST = new Set([
  "Where", "As", "See", "Also", "However", "Therefore", "Thus", "Hence",
  "Moreover", "Furthermore", "Nevertheless", "Although", "Because", "Since",
  "Before", "After", "During", "While", "Until", "Unless", "When", "What",
  "Who", "Which", "That", "This", "These", "Those", "Here", "There",
  "The", "An", "And", "But", "Or", "For", "Nor", "So", "Yet",
  "Argued", "Decided", "Held", "Ruled", "Stated", "Found", "Concluded",
  "Affirmed", "Reversed", "Remanded", "Denied", "Granted", "Filed",
  "Noted", "Observed", "Recognized", "Emphasized", "Highlighted",
  "Bench", "Opinion", "Syllabus", "Note", "Section", "Chapter", "Part",
  "Appendix", "Exhibit", "Schedule", "Footnote", "Citation", "Reference",
  "Court", "Judge", "Justice", "Plaintiff", "Defendant", "Appellant", "Appellee",
  "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "Id", "Ibid", "Supra", "Infra", "Cf", "See", "Eg", "Ie",
  "U", "Federal", "State", "National", "International", "Local", "Regional",
  "Page", "Vol", "No", "Art", "Sec", "Par", "Para",
]);

const TEMPORAL_PATTERNS = [
  /^(Argued|Decided|Filed|Submitted|Heard)\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i,
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+/i,
  /^\d{4}\s+(Term|Session|Hearing)/i,
];

const DOCUMENT_SECTION_PATTERNS = [
  /^(Bench\s+Opinion|Syllabus\s+Note|Opinion\s+of\s+the\s+Court)/i,
  /^(Concurring\s+Opinion|Dissenting\s+Opinion|Majority\s+Opinion)/i,
  /^(Part\s+[IVX]+|Section\s+\d+|Chapter\s+\d+)/i,
  /^(Appendix\s+[A-Z]|Exhibit\s+\d+|Schedule\s+[A-Z])/i,
];

const PERSON_PATTERNS = [
  /^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Hon\.|Rev\.|Sen\.|Rep\.)\s+[A-Z]/,
  /^[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+$/,
  /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Jr\.|Sr\.|III|IV|V)$/,
];

const LOCATION_PATTERNS = [
  /\b(Street|St\.|Avenue|Ave\.|Road|Rd\.|Boulevard|Blvd\.|Drive|Dr\.|Lane|Ln\.)\b/i,
  /\b(City|County|State|Province|Country|Nation|District)\b/i,
  /\b(North|South|East|West|Northern|Southern|Eastern|Western)\s+[A-Z]/,
];

const ORGANIZATION_PATTERNS = [
  /\b(Inc\.|LLC|Ltd\.|Corp\.|Co\.|GmbH|S\.A\.|Pty|Plc|LLP|LP)\b/i,
  /\b(Department|Agency|Commission|Board|Authority|Bureau|Office|Ministry)\b/i,
  /\b(University|College|Institute|School|Academy)\b/i,
  /\b(Association|Foundation|Society|Council|Committee|Organization)\b/i,
  /\b(Bank|Insurance|Holdings|Group|Partners|Consulting)\b/i,
];

function isDenied(text: string): boolean {
  const trimmed = text.trim();
  const titleCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (ORGANIZATION_DENYLIST.has(trimmed) || ORGANIZATION_DENYLIST.has(titleCase) || ORGANIZATION_DENYLIST.has(trimmed.toLowerCase())) return true;
  if (trimmed.length <= 2 && !/^[A-Z]{2}$/.test(trimmed)) return true;
  if (/^[A-Z]\.$/.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  return false;
}

function isTemporalPhrase(text: string): boolean {
  return TEMPORAL_PATTERNS.some(p => p.test(text));
}

function isDocumentSection(text: string): boolean {
  return DOCUMENT_SECTION_PATTERNS.some(p => p.test(text));
}

function classifyEntityType(text: string, canonical: string): EntityClass {
  if (isDenied(text)) return "EXCLUDED";
  if (isDocumentSection(text)) return "DocumentSection";
  if (PERSON_PATTERNS.some(p => p.test(text))) return "Person";
  if (LOCATION_PATTERNS.some(p => p.test(text))) return "Location";
  if (ORGANIZATION_PATTERNS.some(p => p.test(text))) return "Organization";
  const wordCount = text.split(/\s+/).length;
  if (wordCount === 1 || wordCount === 2) {
    if (/^[A-Z][a-z]+$/.test(text.split(/\s+/)[0])) {
      return "Person";
    }
  }
  return "Organization";
}

function computeConfidence(
  entity: ExtractedEntity,
  canonicalFrequency: number,
  entityClass: EntityClass
): number {
  let score = 0.5;
  const spanLength = entity.text.length;
  if (spanLength >= 10) score += 0.15;
  else if (spanLength >= 5) score += 0.08;
  else score -= 0.1;
  const wordCount = entity.text.split(/\s+/).length;
  if (wordCount >= 2) score += 0.1;
  if (wordCount >= 3) score += 0.05;
  if (canonicalFrequency >= 3) score += 0.15;
  else if (canonicalFrequency >= 2) score += 0.08;
  if (entityClass === "Organization" && ORGANIZATION_PATTERNS.some(p => p.test(entity.text))) {
    score += 0.1;
  }
  if (entityClass === "Person" && PERSON_PATTERNS.some(p => p.test(entity.text))) {
    score += 0.1;
  }
  if (entity.tier === "PRIMARY") score += 0.1;
  else if (entity.tier === "SECONDARY") score += 0.0;
  else score -= 0.15;
  return Math.max(0.1, Math.min(1.0, score));
}

function extractTemporalEvent(text: string): ReclassifiedItem | null {
  const match = text.match(/^(Argued|Decided|Filed|Submitted|Heard)\s+(.+)/i);
  if (match) {
    return {
      type: "timeline",
      date: match[2],
      date_type: "explicit",
      event: match[1],
      source_entity: text,
    };
  }
  return null;
}

export function sanitizeEntities(entities: ExtractedEntity[]): SanitizationResult {
  const stats = {
    input_count: entities.length,
    output_count: 0,
    denied_count: 0,
    reclassified_count: 0,
    collapsed_count: 0,
  };
  const canonicalCounts = new Map<string, number>();
  entities.forEach(e => {
    canonicalCounts.set(e.canonical, (canonicalCounts.get(e.canonical) || 0) + 1);
  });
  const reclassified_timeline: ReclassifiedItem[] = [];
  const processedEntities: SanitizedEntity[] = [];
  for (const entity of entities) {
    if (isTemporalPhrase(entity.text)) {
      const timelineItem = extractTemporalEvent(entity.text);
      if (timelineItem) {
        reclassified_timeline.push(timelineItem);
        stats.reclassified_count++;
        continue;
      }
    }
    const entityClass = classifyEntityType(entity.text, entity.canonical);
    if (entityClass === "EXCLUDED") {
      stats.denied_count++;
      continue;
    }
    if (entityClass === "DocumentSection") {
      stats.denied_count++;
      continue;
    }
    const canonicalFreq = canonicalCounts.get(entity.canonical) || 1;
    const confidence_score = computeConfidence(entity, canonicalFreq, entityClass);
    processedEntities.push({
      ...entity,
      entity_class: entityClass,
      confidence_score,
      canonical_id: mockHash(entity.canonical),
    });
  }
  const canonicalGroups = new Map<string, SanitizedEntity[]>();
  processedEntities.forEach(e => {
    const group = canonicalGroups.get(e.canonical) || [];
    group.push(e);
    canonicalGroups.set(e.canonical, group);
  });
  const deduplicatedEntities: SanitizedEntity[] = [];
  for (const [canonical, group] of canonicalGroups) {
    const seen = new Set<string>();
    for (const entity of group) {
      const key = `${entity.start}:${entity.end}`;
      if (seen.has(key)) {
        stats.collapsed_count++;
        continue;
      }
      seen.add(key);
      deduplicatedEntities.push(entity);
    }
  }
  stats.output_count = deduplicatedEntities.length;
  return {
    entities: deduplicatedEntities,
    reclassified_timeline,
    stats,
  };
}

export function computePackConfidence(entities: SanitizedEntity[]): number {
  if (entities.length === 0) return 0;
  const included = entities.filter(e => e.tier !== "NOISE");
  if (included.length === 0) return 0.1;
  const avgConfidence = included.reduce((sum, e) => sum + e.confidence_score, 0) / included.length;
  const entityDensity = Math.min(1, included.length / 50);
  const highConfidenceRatio = included.filter(e => e.confidence_score >= 0.7).length / included.length;
  return Math.round((avgConfidence * 0.5 + entityDensity * 0.2 + highConfidenceRatio * 0.3) * 100) / 100;
}
