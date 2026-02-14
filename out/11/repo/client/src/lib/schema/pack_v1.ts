import { z } from "zod";

/**
 * Latest Pack schema (schemaVersion 2). 
 * Filename retained as 'pack_v1.ts' for backward compatibility.
 */

// --- Enums ---

export const EntityTypeEnum = z.enum([
  "person",
  "org",
  "role",
  "asset",
  "publication",
  "event"
]);

export const EdgeTypeEnum = z.enum([
  "affiliated_with",
  "owns",
  "founded",
  "authored",
  "participated_in",
  "knows",
  "employed_by",
  "regulatory_oversight",
  "investment_in",
  // Funding Types (M4.2)
  "funded_by",
  "donated_to",
  "donated_by",
  "sponsored_by",
  "grant_from",
  "grant_to",
  // Enforcement Types (M4.3)
  "censored_by",
  "banned_by",
  "sued_by",
  "threatened_by",
  "fired_by",
  "investigated_by",
  "sanctioned_by",
  "regulated_by",
  "licensed_by"
]);

export const ClaimTypeEnum = z.enum([
  "fact",
  "allegation",
  "inference",
  "opinion"
]);

export const PackTypeEnum = z.enum([
  "public_figure",
  "topic_ecosystem"
]);

// --- Primitives ---

export const EntitySchema = z.object({
  id: z.string(),
  type: EntityTypeEnum,
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

export const EdgeSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  type: EdgeTypeEnum,
  startDate: z.string().optional(), // ISO date string preferred
  endDate: z.string().optional(),
  notes: z.string().optional()
});

export const EvidenceSchema = z.object({
  id: z.string(),
  sourceType: z.string(), // e.g. "News", "Court Document"
  publisher: z.string().optional(),
  title: z.string(),
  url: z.string().optional(),
  date: z.string(), // ISO date
  excerpt: z.string().optional(),
  localHash: z.string().optional(),
  notes: z.string().optional()
});

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  claimType: ClaimTypeEnum,
  claimScope: z.enum(["utterance", "content"]).default("content"), // M7.1: Distinguish "X said Y" (utterance) vs "Y is true" (content)
  confidence: z.number().min(0).max(1), // 0 to 1
  evidenceIds: z.array(z.string()), // Must have >=1 if type is 'fact' (enforced in UI/Business logic)
  counterEvidenceIds: z.array(z.string()).default([]),
  createdAt: z.string() // ISO date
});

// --- Pack Root ---

export const PackSchema = z.object({
  packId: z.string(),
  packType: PackTypeEnum,
  schemaVersion: z.literal(2),
  subjectName: z.string(),
  timestamps: z.object({
    created: z.string(),
    updated: z.string()
  }),
  entities: z.array(EntitySchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  evidence: z.array(EvidenceSchema).default([]),
  claims: z.array(ClaimSchema).default([]),
  sourceExtractPackId: z.string().optional(),
  
  // M7.3: Migration Transparency
  migrationLog: z.array(z.string()).default([]) 
});

// --- Types (inferred) ---

export type Entity = z.infer<typeof EntitySchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Pack = z.infer<typeof PackSchema>;

// Legacy alias for migration compatibility (if needed)
export type PackV1 = Pack; 
export const PackV1Schema = PackSchema;
