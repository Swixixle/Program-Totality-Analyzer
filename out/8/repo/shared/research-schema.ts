/**
 * Research Dataset Schema v1
 * 
 * Defines the structure for anonymized, aggregatable research data exports.
 * This schema enables model behavior research without exposing PII or raw transcripts.
 * 
 * DESIGN PRINCIPLES:
 * 1. NEVER include raw transcript content
 * 2. NEVER include identifiable information (emails, IPs, user IDs)
 * 3. All timestamps are bucketed to prevent correlation attacks
 * 4. Model/platform identifiers are categorical, not raw strings
 * 5. All counts/statistics are pre-aggregated
 * 6. Opt-in consent required before any data enters this pipeline
 */

import { z } from "zod";

// Schema version constant (locked)
export const RESEARCH_SCHEMA_VERSION = "research-dataset/1.0";

// =============================================================================
// RESEARCH RECORD SCHEMA v1.0
// =============================================================================

/**
 * Verification outcome categories (anonymized)
 */
export const verificationOutcomeSchema = z.enum([
  "VERIFIED",           // Full cryptographic verification passed
  "PARTIALLY_VERIFIED", // Hash matched but signature issues
  "UNVERIFIED",         // Verification failed
]);

/**
 * Signature verification categories
 */
export const signatureOutcomeSchema = z.enum([
  "VALID",              // Cryptographically valid signature
  "INVALID",            // Signature verification failed
  "UNTRUSTED_ISSUER",   // Unknown or untrusted key
  "NO_SIGNATURE",       // Receipt had no signature
  "REVOKED_KEY",        // Key was revoked
  "EXPIRED_KEY",        // Key was expired at verification time
]);

/**
 * Chain verification categories
 */
export const chainOutcomeSchema = z.enum([
  "GENESIS",            // First receipt in chain
  "LINKED",             // Successfully linked to previous
  "BROKEN",             // Chain link verification failed
  "NOT_CHECKED",        // Chain not verified
]);

/**
 * Time bucket for privacy-preserving timestamps
 * Granularity: day (prevents correlation attacks while allowing trend analysis)
 */
export const timeBucketSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Platform category (normalized, not raw platform strings)
 * Prevents fingerprinting through unusual platform identifiers
 */
export const platformCategorySchema = z.enum([
  "openai",
  "anthropic", 
  "google",
  "meta",
  "mistral",
  "cohere",
  "other",
  "unknown",
]);

/**
 * Structural statistics (counts only, never raw content)
 */
export const structuralStatsSchema = z.object({
  message_count: z.number().int().min(0),
  user_message_count: z.number().int().min(0),
  assistant_message_count: z.number().int().min(0),
  system_message_count: z.number().int().min(0),
  tool_message_count: z.number().int().min(0),
  
  // Character counts (bucketed to prevent fingerprinting)
  total_chars_bucket: z.enum(["0-100", "100-500", "500-1000", "1000-5000", "5000-10000", "10000+"]),
  avg_message_length_bucket: z.enum(["0-50", "50-100", "100-250", "250-500", "500-1000", "1000+"]),
});

/**
 * Anomaly indicators (boolean flags, no specifics)
 */
export const anomalyIndicatorsSchema = z.object({
  has_timestamp_issues: z.boolean(),
  has_structural_anomalies: z.boolean(),
  has_high_entropy_blocks: z.boolean(),
  has_pii_indicators: z.boolean(),
  has_risk_keywords: z.boolean(),
  
  // Counts without revealing which keywords/patterns
  anomaly_count: z.number().int().min(0),
});

/**
 * Risk keyword presence (category-level only, no counts)
 * This prevents reverse-engineering content from keyword distributions
 */
export const riskCategoryPresenceSchema = z.object({
  instructional_present: z.boolean(),
  medical_present: z.boolean(),
  legal_present: z.boolean(),
  financial_present: z.boolean(),
  self_harm_present: z.boolean(),
});

/**
 * PII detection summary (presence only, never counts that could fingerprint)
 */
export const piiPresenceSchema = z.object({
  email_detected: z.boolean(),
  phone_detected: z.boolean(),
  ssn_detected: z.boolean(),
  ip_detected: z.boolean(),
  any_pii_detected: z.boolean(),
});

/**
 * Main Research Record Schema v1.0
 * 
 * This is the unit of research data that can be safely exported, aggregated,
 * and shared with researchers without privacy concerns.
 */
export const researchRecordSchema = z.object({
  // Schema identifier
  schema: z.literal("research-record/1.0"),
  
  // Anonymized record identifier (NOT the receipt_id - that could be correlated)
  research_id: z.string().uuid(),
  
  // Time bucket (day-level, not exact timestamp)
  capture_date_bucket: timeBucketSchema,
  verification_date_bucket: timeBucketSchema,
  
  // Platform category (normalized)
  platform_category: platformCategorySchema,
  
  // Verification outcomes
  verification_outcome: verificationOutcomeSchema,
  signature_outcome: signatureOutcomeSchema,
  chain_outcome: chainOutcomeSchema,
  
  // Structural statistics
  structural_stats: structuralStatsSchema,
  
  // Anomaly indicators
  anomaly_indicators: anomalyIndicatorsSchema,
  
  // Risk category presence
  risk_categories: riskCategoryPresenceSchema,
  
  // PII presence indicators
  pii_presence: piiPresenceSchema,
  
  // Kill switch status (useful for understanding correction patterns)
  kill_switch_engaged: z.boolean(),
  
  // Interpretation count (not content)
  interpretation_count: z.number().int().min(0),
  
  // Consent tracking
  research_consent: z.object({
    consented: z.boolean(),
    consent_version: z.string(),
    consent_timestamp_bucket: timeBucketSchema,
  }),
});

export type ResearchRecord = z.infer<typeof researchRecordSchema>;

// =============================================================================
// RESEARCH DATASET EXPORT SCHEMA
// =============================================================================

/**
 * Research Dataset Export Schema
 * 
 * Container for batch export of research records with metadata.
 */
export const researchDatasetExportSchema = z.object({
  schema: z.literal("research-dataset/1.0"),
  
  // Export metadata
  export_id: z.string().uuid(),
  exported_at: z.string().datetime(),
  export_version: z.string(),
  
  // Dataset statistics
  record_count: z.number().int().min(0),
  date_range: z.object({
    earliest_bucket: timeBucketSchema,
    latest_bucket: timeBucketSchema,
  }),
  
  // Aggregated summaries (for quick analysis)
  summary: z.object({
    verification_distribution: z.object({
      verified_count: z.number().int().min(0),
      partially_verified_count: z.number().int().min(0),
      unverified_count: z.number().int().min(0),
    }),
    platform_distribution: z.record(platformCategorySchema, z.number().int().min(0)),
    anomaly_rate: z.number().min(0).max(1), // Percentage with any anomaly
    pii_detection_rate: z.number().min(0).max(1), // Percentage with any PII
    kill_switch_rate: z.number().min(0).max(1), // Percentage with kill switch
  }),
  
  // The actual records
  records: z.array(researchRecordSchema),
  
  // Exclusions declaration (what we explicitly DON'T include)
  exclusions: z.object({
    raw_transcripts: z.literal(true),
    receipt_ids: z.literal(true),
    ip_addresses: z.literal(true),
    user_identifiers: z.literal(true),
    exact_timestamps: z.literal(true),
    raw_signatures: z.literal(true),
    public_key_values: z.literal(true),
    pii_values: z.literal(true),
    keyword_instances: z.literal(true),
  }),
});

export type ResearchDatasetExport = z.infer<typeof researchDatasetExportSchema>;

// =============================================================================
// CONSENT SCHEMA
// =============================================================================

/**
 * Research Consent Schema
 * 
 * Tracks opt-in consent for research data inclusion.
 */
export const researchConsentSchema = z.object({
  schema: z.literal("research-consent/1.0"),
  
  // Consent identifier (NOT linked to receipt_id in exports)
  consent_id: z.string().uuid(),
  
  // What the user consented to
  consent_scope: z.object({
    anonymized_statistics: z.boolean(),
    model_behavior_research: z.boolean(),
    academic_publication: z.boolean(),
    commercial_datasets: z.boolean(),
  }),
  
  // Consent version (for tracking policy changes)
  consent_version: z.string(),
  
  // When consent was given (exact, stored internally, bucketed in exports)
  consented_at: z.string().datetime(),
  
  // Revocation support
  revoked: z.boolean().default(false),
  revoked_at: z.string().datetime().optional(),
});

export type ResearchConsent = z.infer<typeof researchConsentSchema>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize platform string to category
 */
export function normalizePlatformCategory(platform: string): z.infer<typeof platformCategorySchema> {
  const lower = platform.toLowerCase();
  if (lower.includes("openai") || lower.includes("gpt")) return "openai";
  if (lower.includes("anthropic") || lower.includes("claude")) return "anthropic";
  if (lower.includes("google") || lower.includes("gemini") || lower.includes("palm")) return "google";
  if (lower.includes("meta") || lower.includes("llama")) return "meta";
  if (lower.includes("mistral")) return "mistral";
  if (lower.includes("cohere")) return "cohere";
  if (!platform || platform.trim() === "") return "unknown";
  return "other";
}

/**
 * Bucket character count for privacy
 */
export function bucketCharCount(count: number): z.infer<typeof structuralStatsSchema>["total_chars_bucket"] {
  if (count < 100) return "0-100";
  if (count < 500) return "100-500";
  if (count < 1000) return "500-1000";
  if (count < 5000) return "1000-5000";
  if (count < 10000) return "5000-10000";
  return "10000+";
}

/**
 * Bucket average message length for privacy
 */
export function bucketAvgLength(avg: number): z.infer<typeof structuralStatsSchema>["avg_message_length_bucket"] {
  if (avg < 50) return "0-50";
  if (avg < 100) return "50-100";
  if (avg < 250) return "100-250";
  if (avg < 500) return "250-500";
  if (avg < 1000) return "500-1000";
  return "1000+";
}

/**
 * Convert ISO timestamp to day bucket
 */
export function toDateBucket(isoTimestamp: string): string {
  try {
    const date = new Date(isoTimestamp);
    return date.toISOString().split("T")[0];
  } catch {
    return "1970-01-01"; // Fallback for invalid dates
  }
}
