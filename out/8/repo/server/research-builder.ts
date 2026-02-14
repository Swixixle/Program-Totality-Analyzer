/**
 * P5 Research Record Builder
 * 
 * Pure function that builds anonymized research records from verification results.
 * 
 * HARD CONSTRAINTS:
 * - NO transcripts or raw content
 * - NO receipt_id or correlation identifiers
 * - NO exact timestamps (day buckets only)
 * - NO hashes or keys
 * - NO PII values (presence flags only)
 * - Deterministic and side-effect free
 */

import { randomUUID } from "crypto";
import {
  RESEARCH_SCHEMA_VERSION,
  normalizePlatformCategory,
  bucketCharCount,
  bucketAvgLength,
  toDateBucket,
  type ResearchRecord,
} from "@shared/research-schema";

interface VerificationData {
  verificationStatus: string;
  signatureStatus: string;
  signatureKeyStatus?: string;
  chainStatus: string;
  platform: string;
  capturedAt: string;
  verifiedAt: string;
  killSwitchEngaged: boolean;
  interpretationCount: number;
}

interface ForensicsData {
  transcript_stats?: {
    message_count?: number;
    roles?: {
      user?: number;
      assistant?: number;
      system?: number;
      tool?: number;
    };
    chars_total?: number;
    avg_chars_per_message?: number;
  };
  timestamp_checks?: {
    missing_count?: number;
    non_iso_count?: number;
    non_monotonic_count?: number;
  };
  content_signals?: {
    high_entropy_block_count?: number;
  };
  structural_anomalies?: {
    missing_role_count?: number;
    empty_content_count?: number;
    unexpected_role_count?: number;
    duplicate_message_count?: number;
    oversize_message_count?: number;
  };
  risk_keywords?: {
    instructional?: { present?: boolean };
    medical?: { present?: boolean };
    legal?: { present?: boolean };
    financial?: { present?: boolean };
    self_harm?: { present?: boolean };
  };
  pii_heuristics?: {
    email_like_count?: number;
    phone_like_count?: number;
    ssn_like_count?: number;
    ip_like_count?: number;
  };
  anomalies?: unknown[];
}

interface ConsentData {
  consented: boolean;
  scope: {
    anonymized_statistics: boolean;
    model_behavior_research: boolean;
    academic_publication: boolean;
    commercial_datasets: boolean;
  };
  version: string;
  consentedAt: string;
}

/**
 * Map signature status to research outcome
 * Preserves REVOKED_KEY and EXPIRED_KEY categories
 */
function mapSignatureOutcome(status: string, keyStatus?: string): ResearchRecord["signature_outcome"] {
  if (status === "VALID") return "VALID";
  if (status === "INVALID") return "INVALID";
  if (status === "NO_SIGNATURE") return "NO_SIGNATURE";
  // Preserve key status categories for research
  if (keyStatus === "REVOKED") return "REVOKED_KEY";
  if (keyStatus === "EXPIRED") return "EXPIRED_KEY";
  return "UNTRUSTED_ISSUER";
}

/**
 * Map chain status to research outcome
 */
function mapChainOutcome(status: string | null | undefined): ResearchRecord["chain_outcome"] {
  if (!status || status === "NOT_CHECKED") return "NOT_CHECKED";
  if (status === "GENESIS") return "GENESIS";
  if (status === "LINKED") return "LINKED";
  if (status === "BROKEN") return "BROKEN";
  return "NOT_CHECKED";
}

/**
 * Bucket interpretation count for privacy
 */
function bucketInterpretationCount(count: number): string {
  if (count === 0) return "0";
  if (count <= 2) return "1-2";
  if (count <= 5) return "3-5";
  if (count <= 10) return "6-10";
  return "10+";
}

/**
 * Build anonymized research record from verification data
 * 
 * This function is:
 * - Deterministic (same inputs → same outputs, except for research_id)
 * - Side-effect free
 * - Testable in isolation
 */
export function buildResearchRecord(
  verification: VerificationData,
  forensics: ForensicsData | null,
  consent: ConsentData
): ResearchRecord {
  const stats = forensics?.transcript_stats || {};
  const risks = forensics?.risk_keywords || {};
  const pii = forensics?.pii_heuristics || {};
  const anomalies = forensics?.structural_anomalies || {};
  const timestamps = forensics?.timestamp_checks || {};
  const content = forensics?.content_signals || {};
  
  // Count total anomalies
  const anomalyCount = 
    (anomalies.missing_role_count || 0) +
    (anomalies.empty_content_count || 0) +
    (anomalies.unexpected_role_count || 0) +
    (anomalies.duplicate_message_count || 0) +
    (anomalies.oversize_message_count || 0) +
    (timestamps.non_iso_count || 0) +
    (timestamps.non_monotonic_count || 0);
  
  // Determine if any anomaly indicators are present
  const hasTimestampIssues = 
    (timestamps.missing_count || 0) > 0 ||
    (timestamps.non_iso_count || 0) > 0 ||
    (timestamps.non_monotonic_count || 0) > 0;
  
  const hasStructuralAnomalies =
    (anomalies.missing_role_count || 0) > 0 ||
    (anomalies.empty_content_count || 0) > 0 ||
    (anomalies.unexpected_role_count || 0) > 0 ||
    (anomalies.duplicate_message_count || 0) > 0 ||
    (anomalies.oversize_message_count || 0) > 0;
  
  const hasHighEntropyBlocks = (content.high_entropy_block_count || 0) > 0;
  
  const hasPiiIndicators =
    (pii.email_like_count || 0) > 0 ||
    (pii.phone_like_count || 0) > 0 ||
    (pii.ssn_like_count || 0) > 0 ||
    (pii.ip_like_count || 0) > 0;
  
  const hasRiskKeywords =
    risks.instructional?.present ||
    risks.medical?.present ||
    risks.legal?.present ||
    risks.financial?.present ||
    risks.self_harm?.present;
  
  const totalChars = stats.chars_total || 0;
  const avgChars = stats.avg_chars_per_message || 0;
  const messageCount = stats.message_count || 0;
  
  return {
    schema: "research-record/1.0",
    research_id: randomUUID(),
    
    // Day-level buckets only
    capture_date_bucket: toDateBucket(verification.capturedAt),
    verification_date_bucket: toDateBucket(verification.verifiedAt),
    
    // Normalized platform
    platform_category: normalizePlatformCategory(verification.platform),
    
    // Categorical outcomes
    verification_outcome: verification.verificationStatus as ResearchRecord["verification_outcome"],
    signature_outcome: mapSignatureOutcome(verification.signatureStatus, verification.signatureKeyStatus),
    chain_outcome: mapChainOutcome(verification.chainStatus),
    
    // Structural stats (bucketed)
    structural_stats: {
      message_count: messageCount,
      user_message_count: stats.roles?.user || 0,
      assistant_message_count: stats.roles?.assistant || 0,
      system_message_count: stats.roles?.system || 0,
      tool_message_count: stats.roles?.tool || 0,
      total_chars_bucket: bucketCharCount(totalChars),
      avg_message_length_bucket: bucketAvgLength(avgChars),
    },
    
    // Anomaly indicators (boolean flags only)
    anomaly_indicators: {
      has_timestamp_issues: hasTimestampIssues,
      has_structural_anomalies: hasStructuralAnomalies,
      has_high_entropy_blocks: hasHighEntropyBlocks,
      has_pii_indicators: hasPiiIndicators,
      has_risk_keywords: hasRiskKeywords || false,
      anomaly_count: anomalyCount,
    },
    
    // Risk categories (presence only, no counts)
    risk_categories: {
      instructional_present: risks.instructional?.present || false,
      medical_present: risks.medical?.present || false,
      legal_present: risks.legal?.present || false,
      financial_present: risks.financial?.present || false,
      self_harm_present: risks.self_harm?.present || false,
    },
    
    // PII presence (boolean only, NEVER values)
    pii_presence: {
      email_detected: (pii.email_like_count || 0) > 0,
      phone_detected: (pii.phone_like_count || 0) > 0,
      ssn_detected: (pii.ssn_like_count || 0) > 0,
      ip_detected: (pii.ip_like_count || 0) > 0,
      any_pii_detected: hasPiiIndicators,
    },
    
    kill_switch_engaged: verification.killSwitchEngaged,
    interpretation_count: verification.interpretationCount,
    
    // Consent tracking
    research_consent: {
      consented: consent.consented,
      consent_version: consent.version,
      consent_timestamp_bucket: toDateBucket(consent.consentedAt),
    },
  };
}

/**
 * Convert ResearchRecord to database insert format
 */
export function toDbFormat(record: ResearchRecord): {
  researchId: string;
  datasetVersion: string;
  captureDateBucket: string;
  verificationDateBucket: string;
  platformCategory: string;
  verificationOutcome: string;
  signatureOutcome: string;
  chainOutcome: string;
  structuralStats: string;
  anomalyIndicators: string;
  riskCategories: string;
  piiPresence: string;
  killSwitchEngaged: number;
  interpretationBucket: string;
  consentScope: string;
  createdAtBucket: string;
} {
  return {
    researchId: record.research_id,
    datasetVersion: RESEARCH_SCHEMA_VERSION,
    captureDateBucket: record.capture_date_bucket,
    verificationDateBucket: record.verification_date_bucket,
    platformCategory: record.platform_category,
    verificationOutcome: record.verification_outcome,
    signatureOutcome: record.signature_outcome,
    chainOutcome: record.chain_outcome,
    structuralStats: JSON.stringify(record.structural_stats),
    anomalyIndicators: JSON.stringify(record.anomaly_indicators),
    riskCategories: JSON.stringify(record.risk_categories),
    piiPresence: JSON.stringify(record.pii_presence),
    killSwitchEngaged: record.kill_switch_engaged ? 1 : 0,
    interpretationBucket: bucketInterpretationCount(record.interpretation_count),
    consentScope: JSON.stringify(record.research_consent),
    createdAtBucket: toDateBucket(new Date().toISOString()),
  };
}
