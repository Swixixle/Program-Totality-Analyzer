import { z } from "zod";

export const VerifiedRecordVersionSchema = z.literal("1.0.0");

export const SourceEntrySchema = z.object({
  source_id: z.string(),
  filename: z.string(),
  role: z.enum(["PRIMARY", "SECONDARY"]),
  sha256_hex: z.string(),
  uploaded_at: z.string(),
  page_count: z.number().nullable(),
});

export const AnchorEntrySchema = z.object({
  anchor_id: z.string(),
  source_id: z.string(),
  source_document: z.string(),
  quote: z.string(),
  page_ref: z.string(),
  section_ref: z.string().nullable(),
  timeline_date: z.string().nullable(),
  byte_offset_start: z.number().nullable(),
  byte_offset_end: z.number().nullable(),
});

export const SupportedClaimSchema = z.object({
  claim_id: z.string(),
  classification: z.literal("DEFENSIBLE"),
  text: z.string(),
  confidence: z.number(),
  anchor_ids: z.array(z.string()),
  anchors: z.array(AnchorEntrySchema),
  created_at: z.string(),
});

export const RestrictedClaimSchema = z.object({
  claim_id: z.string(),
  classification: z.literal("RESTRICTED"),
  text: z.string(),
  refusal_reason: z.string(),
  anchor_ids: z.array(z.string()),
  created_at: z.string(),
});

export const AmbiguousClaimSchema = z.object({
  claim_id: z.string(),
  classification: z.literal("AMBIGUOUS"),
  text: z.string(),
  confidence: z.number(),
  anchor_ids: z.array(z.string()),
  anchors: z.array(AnchorEntrySchema),
  created_at: z.string(),
});

export const ConflictEntrySchema = z.object({
  constraint_id: z.string(),
  type: z.literal("CONFLICT"),
  summary: z.string(),
  claim_id: z.string().nullable(),
  left_anchor: z.object({
    anchor_id: z.string(),
    source_document: z.string(),
    page_ref: z.string(),
  }),
  right_anchor: z.object({
    anchor_id: z.string(),
    source_document: z.string(),
    page_ref: z.string(),
  }),
});

export const MissingEvidenceEntrySchema = z.object({
  constraint_id: z.string(),
  type: z.literal("MISSING_EVIDENCE"),
  summary: z.string(),
  requested_assertion: z.string(),
  reason: z.string(),
});

export const TimeMismatchEntrySchema = z.object({
  constraint_id: z.string(),
  type: z.literal("TIME_MISMATCH"),
  summary: z.string(),
  claim_id: z.string().nullable(),
  earlier_date: z.string(),
  later_date: z.string(),
  note: z.string(),
});

export const IntegrityMetadataSchema = z.object({
  record_hash_alg: z.literal("SHA-256"),
  record_hash_hex: z.string(),
  generated_at: z.string(),
  schema_version: VerifiedRecordVersionSchema,
  corpus_id: z.string(),
  corpus_purpose: z.string(),
  corpus_created_at: z.string(),
});

export const VerifiedRecordSchema = z.object({
  schema: z.literal("lantern.verified_record.v1"),
  integrity: IntegrityMetadataSchema,
  sources: z.array(SourceEntrySchema),
  supported_claims: z.array(SupportedClaimSchema),
  restricted_claims: z.array(RestrictedClaimSchema),
  ambiguous_claims: z.array(AmbiguousClaimSchema),
  conflicts: z.array(ConflictEntrySchema),
  missing_evidence: z.array(MissingEvidenceEntrySchema),
  time_mismatches: z.array(TimeMismatchEntrySchema),
  summary: z.object({
    total_sources: z.number(),
    total_anchors: z.number(),
    total_claims: z.number(),
    supported_count: z.number(),
    restricted_count: z.number(),
    ambiguous_count: z.number(),
    conflicts_count: z.number(),
    missing_evidence_count: z.number(),
    time_mismatches_count: z.number(),
  }),
});

export type VerifiedRecord = z.infer<typeof VerifiedRecordSchema>;
export type SourceEntry = z.infer<typeof SourceEntrySchema>;
export type AnchorEntry = z.infer<typeof AnchorEntrySchema>;
export type SupportedClaim = z.infer<typeof SupportedClaimSchema>;
export type RestrictedClaim = z.infer<typeof RestrictedClaimSchema>;
export type AmbiguousClaim = z.infer<typeof AmbiguousClaimSchema>;
export type ConflictEntry = z.infer<typeof ConflictEntrySchema>;
export type MissingEvidenceEntry = z.infer<typeof MissingEvidenceEntrySchema>;
export type TimeMismatchEntry = z.infer<typeof TimeMismatchEntrySchema>;
export type IntegrityMetadata = z.infer<typeof IntegrityMetadataSchema>;
