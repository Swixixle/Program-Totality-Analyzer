import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { 
  PackSchema, 
  Pack, 
  EntityTypeEnum, 
  Entity, 
  Evidence, 
  Claim 
} from "../schema/pack_v1";
import { LanternPack, EntityItem, QuoteItem, TimelineItem } from "../lanternExtract";

/**
 * Creates a curated Pack (Dossier) from a raw LanternPack (Extract).
 * This is a conversion process, not a migration, preserving the original extract.
 */
export function createDossierFromExtract(
  extract: LanternPack, 
  opts: { 
    subjectName?: string; 
    packType?: "public_figure" | "topic_ecosystem" 
    schemaVersion?: 2
  } = {}
): Pack {
  
  // 1. Metadata
  const packId = uuidv4();
  const created = new Date().toISOString();
  
  const dossier: Pack = {
    packId,
    packType: opts.packType || (opts.subjectName ? "public_figure" : "topic_ecosystem"),
    schemaVersion: 2,
    subjectName: opts.subjectName || extract.source?.title || "Untitled Subject",
    timestamps: { created, updated: created },
    entities: [],
    edges: [],
    evidence: [],
    claims: [],
    migrationLog: [],
    sourceExtractPackId: extract.pack_id
  };

  // 2. Convert Entities
  // Mapping Table: Extract Types -> Dossier Types
  const mapEntityType = (t: string): z.infer<typeof EntityTypeEnum> => {
    const norm = t.toLowerCase();
    if (norm === "person") return "person";
    if (norm === "organization") return "org";
    if (norm === "location") return "asset"; // Tagged later
    if (norm === "event") return "event";
    if (norm === "product") return "asset";
    return "org"; // Default fallback
  };

  const entityMap = new Map<string, string>(); // Extract ID -> Dossier ID

  extract.items.entities.forEach((e: EntityItem) => {
    if (!e.included) return;
    
    const newId = uuidv4();
    entityMap.set(e.id, newId);

    const mappedType = mapEntityType(e.type);
    const tags = ["imported_from_extract"];
    
    // Explicitly tag remapped types
    if (e.type.toLowerCase() === "location" && mappedType === "asset") {
        tags.push("source_entity_type:location");
    }

    dossier.entities.push({
      id: newId,
      type: mappedType,
      name: e.text,
      aliases: [],
      tags
    });
  });

  // 3. Convert Evidence (Source Document)
  const sourceEvidenceId = uuidv4();
  
  const normalizeSourceType = (s?: string) => {
    const v = (s || "").toLowerCase();
    if (v.includes("news")) return "News";
    if (v.includes("filing")) return "Filing";
    if (v.includes("transcript")) return "Transcript";
    return "Unknown";
  };

  dossier.evidence.push({
    id: sourceEvidenceId,
    sourceType: normalizeSourceType(extract.source?.source_type),
    publisher: extract.source?.publisher || "Unknown",
    title: extract.source?.title || "Untitled Source",
    url: extract.source?.url,
    date: extract.source?.published_at || created,
    excerpt: "Full source text extract.",
    notes: `Original Extract ID: ${extract.pack_id}`
  });

  // 4. Convert Quotes -> Evidence + "Existence" Claims
  extract.items.quotes.forEach((q: QuoteItem) => {
    if (!q.included) return;

    const evidenceId = uuidv4();
    
    // Quote as Evidence
    dossier.evidence.push({
      id: evidenceId,
      sourceType: "quote", // Allowed as loose string in schema for now, or tighten later
      publisher: q.speaker || "Unknown Speaker",
      title: `Quote: "${q.quote.slice(0, 50)}..."`,
      date: extract.source?.published_at || created,
      excerpt: q.quote,
      notes: q.speaker ? `Attributed to ${q.speaker}` : "Unattributed"
    });

    // "Existence of Statement" Claim (Safe Default)
    const claimId = uuidv4();
    const speaker = q.speaker?.trim() || "Unknown speaker";
    const claimText = `This source attributes the following statement to ${speaker}: "${q.quote}"`;

    dossier.claims.push({
      id: claimId,
      text: claimText,
      claimType: "fact", // Fact of utterance
      claimScope: "utterance", // This is about what was said, not its truth
      confidence: speaker === "Unknown speaker" ? 0.7 : 0.9,
      evidenceIds: [evidenceId, sourceEvidenceId], // Link to quote + source doc
      counterEvidenceIds: [],
      createdAt: created
    });
  });

  // 5. Convert Timeline -> Evidence (Events)
  extract.items.timeline.forEach((t: TimelineItem) => {
    if (!t.included) return;

    const evidenceId = uuidv4();
    dossier.evidence.push({
      id: evidenceId,
      sourceType: "timeline_event",
      title: `Event: ${t.event} (${t.date})`,
      date: created, // Keep created as the strict ISO date
      excerpt: t.event,
      notes: `Extracted date string: ${t.date}` // Preserve original string here
    });
  });

  // 6. Metrics -> Claims (Fact)
  extract.items.metrics.forEach((m: any) => {
     if (!m.included) return;
     
     const claimId = uuidv4();
     dossier.claims.push({
        id: claimId,
        text: `Metric: ${m.value} ${m.unit} (${m.metric_kind})`,
        claimType: "fact",
        claimScope: "content", // Metric is about the value itself
        confidence: m.confidence || 0.8,
        evidenceIds: [sourceEvidenceId],
        counterEvidenceIds: [],
        createdAt: created
     });
  });
  
  // Final Validation
  dossier.timestamps.updated = new Date().toISOString();
  return PackSchema.parse(dossier);
}

