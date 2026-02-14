import { createHash } from "crypto";
import { storage } from "./storage";
import type {
  VerifiedRecord,
  SourceEntry,
  AnchorEntry,
  SupportedClaim,
  RestrictedClaim,
  AmbiguousClaim,
  ConflictEntry,
  MissingEvidenceEntry,
  TimeMismatchEntry,
} from "../shared/verifiedRecord";

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>).sort().forEach(key => {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    });
    return sorted;
  }
  return obj;
}

function canonicalStringify(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

interface ConstraintConflict {
  left: { anchor_id: string; source_document: string; page_ref: string };
  right: { anchor_id: string; source_document: string; page_ref: string };
}

interface ConstraintMissing {
  requested_assertion: string;
  reason: string;
}

interface ConstraintTimeContext {
  earlier_date: string;
  later_date: string;
  note: string;
}

function parseJsonField<T>(field: string | null): T | null {
  if (!field) return null;
  try {
    return JSON.parse(field) as T;
  } catch {
    return null;
  }
}

export async function generateVerifiedRecord(corpusId: string): Promise<VerifiedRecord | null> {
  const corpus = await storage.getCorpus(corpusId);
  if (!corpus) return null;

  const sources = await storage.listCorpusSources(corpusId);
  const anchors = await storage.listAnchorRecordsByCorpus(corpusId);
  const claims = await storage.listClaimRecordsByCorpus(corpusId);
  const constraints = await storage.listConstraintsByCorpus(corpusId);

  const anchorMap = new Map(anchors.map(a => [a.id, a]));
  const sourceMap = new Map(sources.map(s => [s.id, s]));

  const sourceEntries: SourceEntry[] = sources.map(s => ({
    source_id: s.id,
    filename: s.filename,
    role: s.role as "PRIMARY" | "SECONDARY",
    sha256_hex: s.sha256Hex,
    uploaded_at: s.uploadedAt.toISOString(),
    page_count: s.pageCount,
  })).sort((a, b) => a.source_id.localeCompare(b.source_id));

  const anchorEntries: AnchorEntry[] = anchors.map(a => {
    const source = sourceMap.get(a.sourceId);
    return {
      anchor_id: a.id,
      source_id: a.sourceId,
      source_document: source?.filename || a.sourceDocument,
      quote: a.quote,
      page_ref: a.pageRef,
      section_ref: a.sectionRef,
      timeline_date: a.timelineDate,
      byte_offset_start: a.byteOffsetStart,
      byte_offset_end: a.byteOffsetEnd,
    };
  }).sort((a, b) => a.anchor_id.localeCompare(b.anchor_id));

  const getAnchorsForClaim = (anchorIds: string[]): AnchorEntry[] => {
    return [...anchorIds].sort()
      .map(id => anchorEntries.find(a => a.anchor_id === id))
      .filter((a): a is AnchorEntry => a !== undefined);
  };

  const supportedClaims: SupportedClaim[] = claims
    .filter(c => c.classification === "DEFENSIBLE")
    .map(c => ({
      claim_id: c.id,
      classification: "DEFENSIBLE" as const,
      text: c.text,
      confidence: c.confidence,
      anchor_ids: [...c.anchorIds].sort(),
      anchors: getAnchorsForClaim(c.anchorIds),
      created_at: c.createdAt.toISOString(),
    }))
    .sort((a, b) => a.claim_id.localeCompare(b.claim_id));

  const restrictedClaims: RestrictedClaim[] = claims
    .filter(c => c.classification === "RESTRICTED")
    .map(c => ({
      claim_id: c.id,
      classification: "RESTRICTED" as const,
      text: c.text,
      refusal_reason: c.refusalReason || "No reason provided",
      anchor_ids: [...c.anchorIds].sort(),
      created_at: c.createdAt.toISOString(),
    }))
    .sort((a, b) => a.claim_id.localeCompare(b.claim_id));

  const ambiguousClaims: AmbiguousClaim[] = claims
    .filter(c => c.classification === "AMBIGUOUS")
    .map(c => ({
      claim_id: c.id,
      classification: "AMBIGUOUS" as const,
      text: c.text,
      confidence: c.confidence,
      anchor_ids: [...c.anchorIds].sort(),
      anchors: getAnchorsForClaim(c.anchorIds),
      created_at: c.createdAt.toISOString(),
    }))
    .sort((a, b) => a.claim_id.localeCompare(b.claim_id));

  const conflicts: ConflictEntry[] = constraints
    .filter(c => c.type === "CONFLICT")
    .map(c => {
      const conflictData = parseJsonField<ConstraintConflict>(c.conflict);
      if (!conflictData) return null;
      return {
        constraint_id: c.id,
        type: "CONFLICT" as const,
        summary: c.summary,
        claim_id: c.claimId,
        left_anchor: {
          anchor_id: conflictData.left.anchor_id,
          source_document: conflictData.left.source_document,
          page_ref: conflictData.left.page_ref,
        },
        right_anchor: {
          anchor_id: conflictData.right.anchor_id,
          source_document: conflictData.right.source_document,
          page_ref: conflictData.right.page_ref,
        },
      };
    })
    .filter((c): c is ConflictEntry => c !== null)
    .sort((a, b) => a.constraint_id.localeCompare(b.constraint_id));

  const missingEvidence: MissingEvidenceEntry[] = constraints
    .filter(c => c.type === "MISSING_EVIDENCE")
    .map(c => {
      const missingData = parseJsonField<ConstraintMissing>(c.missing);
      if (!missingData) return null;
      return {
        constraint_id: c.id,
        type: "MISSING_EVIDENCE" as const,
        summary: c.summary,
        requested_assertion: missingData.requested_assertion,
        reason: missingData.reason,
      };
    })
    .filter((c): c is MissingEvidenceEntry => c !== null)
    .sort((a, b) => a.constraint_id.localeCompare(b.constraint_id));

  const timeMismatches: TimeMismatchEntry[] = constraints
    .filter(c => c.type === "TIME_MISMATCH")
    .map(c => {
      const timeData = parseJsonField<ConstraintTimeContext>(c.timeContext);
      if (!timeData) return null;
      return {
        constraint_id: c.id,
        type: "TIME_MISMATCH" as const,
        summary: c.summary,
        claim_id: c.claimId,
        earlier_date: timeData.earlier_date,
        later_date: timeData.later_date,
        note: timeData.note,
      };
    })
    .filter((c): c is TimeMismatchEntry => c !== null)
    .sort((a, b) => a.constraint_id.localeCompare(b.constraint_id));

  const generatedAt = new Date().toISOString();

  const recordWithoutHash: Omit<VerifiedRecord, "integrity"> & { integrity: Omit<VerifiedRecord["integrity"], "record_hash_hex"> } = {
    schema: "lantern.verified_record.v1",
    integrity: {
      record_hash_alg: "SHA-256",
      generated_at: generatedAt,
      schema_version: "1.0.0",
      corpus_id: corpusId,
      corpus_purpose: corpus.purpose,
      corpus_created_at: corpus.createdAt.toISOString(),
    },
    sources: sourceEntries,
    supported_claims: supportedClaims,
    restricted_claims: restrictedClaims,
    ambiguous_claims: ambiguousClaims,
    conflicts,
    missing_evidence: missingEvidence,
    time_mismatches: timeMismatches,
    summary: {
      total_sources: sourceEntries.length,
      total_anchors: anchorEntries.length,
      total_claims: claims.length,
      supported_count: supportedClaims.length,
      restricted_count: restrictedClaims.length,
      ambiguous_count: ambiguousClaims.length,
      conflicts_count: conflicts.length,
      missing_evidence_count: missingEvidence.length,
      time_mismatches_count: timeMismatches.length,
    },
  };

  const contentToHash = canonicalStringify({
    sources: recordWithoutHash.sources,
    supported_claims: recordWithoutHash.supported_claims,
    restricted_claims: recordWithoutHash.restricted_claims,
    ambiguous_claims: recordWithoutHash.ambiguous_claims,
    conflicts: recordWithoutHash.conflicts,
    missing_evidence: recordWithoutHash.missing_evidence,
    time_mismatches: recordWithoutHash.time_mismatches,
  });

  const recordHash = sha256(contentToHash);

  const verifiedRecord: VerifiedRecord = {
    ...recordWithoutHash,
    integrity: {
      ...recordWithoutHash.integrity,
      record_hash_hex: recordHash,
    },
  };

  return verifiedRecord;
}

export function generateVerifiedRecordPDF(record: VerifiedRecord): string {
  const lines: string[] = [];
  
  lines.push("═".repeat(80));
  lines.push("LANTERN VERIFIED RECORD");
  lines.push("═".repeat(80));
  lines.push("");
  lines.push(`Corpus ID: ${record.integrity.corpus_id}`);
  lines.push(`Purpose: ${record.integrity.corpus_purpose}`);
  lines.push(`Generated: ${record.integrity.generated_at}`);
  lines.push(`Schema Version: ${record.integrity.schema_version}`);
  lines.push(`Record Hash (${record.integrity.record_hash_alg}): ${record.integrity.record_hash_hex}`);
  lines.push("");
  
  lines.push("─".repeat(80));
  lines.push("SUMMARY");
  lines.push("─".repeat(80));
  lines.push(`Total Sources: ${record.summary.total_sources}`);
  lines.push(`Total Anchors: ${record.summary.total_anchors}`);
  lines.push(`Total Claims: ${record.summary.total_claims}`);
  lines.push(`  - Supported (DEFENSIBLE): ${record.summary.supported_count}`);
  lines.push(`  - Restricted: ${record.summary.restricted_count}`);
  lines.push(`  - Ambiguous: ${record.summary.ambiguous_count}`);
  lines.push(`Conflicts: ${record.summary.conflicts_count}`);
  lines.push(`Missing Evidence: ${record.summary.missing_evidence_count}`);
  lines.push(`Time Mismatches: ${record.summary.time_mismatches_count}`);
  lines.push("");

  lines.push("─".repeat(80));
  lines.push("INPUT SOURCES");
  lines.push("─".repeat(80));
  for (const src of record.sources) {
    lines.push(`[${src.role}] ${src.filename}`);
    lines.push(`  ID: ${src.source_id}`);
    lines.push(`  SHA-256: ${src.sha256_hex}`);
    lines.push(`  Uploaded: ${src.uploaded_at}`);
    if (src.page_count) lines.push(`  Pages: ${src.page_count}`);
    lines.push("");
  }

  lines.push("─".repeat(80));
  lines.push("SUPPORTED CLAIMS (DEFENSIBLE)");
  lines.push("─".repeat(80));
  if (record.supported_claims.length === 0) {
    lines.push("No supported claims.");
    lines.push("");
  }
  for (const claim of record.supported_claims) {
    lines.push(`Claim ID: ${claim.claim_id}`);
    lines.push(`Text: "${claim.text}"`);
    lines.push(`Confidence: ${(claim.confidence * 100).toFixed(0)}%`);
    lines.push(`Anchors:`);
    for (const anchor of claim.anchors) {
      lines.push(`  - "${anchor.quote.substring(0, 100)}${anchor.quote.length > 100 ? "..." : ""}"`);
      lines.push(`    Source: ${anchor.source_document}, ${anchor.page_ref}`);
    }
    lines.push("");
  }

  lines.push("─".repeat(80));
  lines.push("RESTRICTED CLAIMS (REFUSED)");
  lines.push("─".repeat(80));
  if (record.restricted_claims.length === 0) {
    lines.push("No restricted claims.");
    lines.push("");
  }
  for (const claim of record.restricted_claims) {
    lines.push(`Claim ID: ${claim.claim_id}`);
    lines.push(`Text: "${claim.text}"`);
    lines.push(`Refusal Reason: ${claim.refusal_reason}`);
    lines.push("");
  }

  lines.push("─".repeat(80));
  lines.push("AMBIGUOUS CLAIMS");
  lines.push("─".repeat(80));
  if (record.ambiguous_claims.length === 0) {
    lines.push("No ambiguous claims.");
    lines.push("");
  }
  for (const claim of record.ambiguous_claims) {
    lines.push(`Claim ID: ${claim.claim_id}`);
    lines.push(`Text: "${claim.text}"`);
    lines.push(`Confidence: ${(claim.confidence * 100).toFixed(0)}%`);
    lines.push("");
  }

  lines.push("─".repeat(80));
  lines.push("CONFLICTS");
  lines.push("─".repeat(80));
  if (record.conflicts.length === 0) {
    lines.push("No conflicts detected.");
    lines.push("");
  }
  for (const conflict of record.conflicts) {
    lines.push(`Conflict ID: ${conflict.constraint_id}`);
    lines.push(`Summary: ${conflict.summary}`);
    lines.push(`Left: ${conflict.left_anchor.source_document} (${conflict.left_anchor.page_ref})`);
    lines.push(`Right: ${conflict.right_anchor.source_document} (${conflict.right_anchor.page_ref})`);
    lines.push("");
  }

  lines.push("─".repeat(80));
  lines.push("MISSING EVIDENCE");
  lines.push("─".repeat(80));
  if (record.missing_evidence.length === 0) {
    lines.push("No missing evidence noted.");
    lines.push("");
  }
  for (const missing of record.missing_evidence) {
    lines.push(`ID: ${missing.constraint_id}`);
    lines.push(`Summary: ${missing.summary}`);
    lines.push(`Requested: ${missing.requested_assertion}`);
    lines.push(`Reason: ${missing.reason}`);
    lines.push("");
  }

  lines.push("─".repeat(80));
  lines.push("TIME MISMATCHES");
  lines.push("─".repeat(80));
  if (record.time_mismatches.length === 0) {
    lines.push("No time mismatches detected.");
    lines.push("");
  }
  for (const tm of record.time_mismatches) {
    lines.push(`ID: ${tm.constraint_id}`);
    lines.push(`Summary: ${tm.summary}`);
    lines.push(`Earlier: ${tm.earlier_date} | Later: ${tm.later_date}`);
    lines.push(`Note: ${tm.note}`);
    lines.push("");
  }

  lines.push("═".repeat(80));
  lines.push("END OF VERIFIED RECORD");
  lines.push("═".repeat(80));

  return lines.join("\n");
}
