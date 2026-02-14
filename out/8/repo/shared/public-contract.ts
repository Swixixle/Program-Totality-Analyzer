/**
 * P6.6 Public Endpoint Contract Hardening
 * 
 * Canonical error taxonomy, response envelopes, and contract guarantees
 * for all public-facing endpoints.
 */

// =============================================================================
// CANONICAL ERROR CODES
// =============================================================================

/**
 * Standard error codes for public API responses.
 * All public endpoints MUST use these codes for consistency.
 */
export const PUBLIC_ERROR_CODES = {
  // 4xx Client Errors
  RECEIPT_NOT_FOUND: "RECEIPT_NOT_FOUND",
  INVALID_RECEIPT_ID: "INVALID_RECEIPT_ID",
  INVALID_REQUEST_BODY: "INVALID_REQUEST_BODY",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  KILL_SWITCH_ENGAGED: "KILL_SWITCH_ENGAGED",
  
  // 5xx Server Errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type PublicErrorCode = typeof PUBLIC_ERROR_CODES[keyof typeof PUBLIC_ERROR_CODES];

// =============================================================================
// ERROR RESPONSE ENVELOPE
// =============================================================================

/**
 * Standard error response envelope for all public endpoints.
 */
export interface PublicErrorResponse {
  schema: "ai-receipt/error/1.0";
  error: {
    code: PublicErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  request_id?: string;
  timestamp: string;
}

export function createPublicError(
  code: PublicErrorCode,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): PublicErrorResponse {
  return {
    schema: "ai-receipt/error/1.0",
    error: {
      code,
      message,
      ...(details && { details }),
    },
    ...(requestId && { request_id: requestId }),
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// TRANSCRIPT MODE CONTRACT (P6.6 Corrected)
// =============================================================================

/**
 * TRANSCRIPT_MODE is a RENDERING/REDACTION mode for API responses.
 * 
 * CRITICAL CONTRACT GUARANTEES:
 * 1. Raw transcripts are NEVER persisted to the database
 * 2. Only integrity proofs are stored (hash, c14n summary, signature, chain)
 * 3. TRANSCRIPT_MODE controls ephemeral rendering in API responses
 * 4. Transcripts are processed ephemerally for hash verification then discarded
 * 
 * What IS stored (integrity proofs only):
 * - computed_hash_sha256, expected_hash_sha256, receipt_hash_sha256
 * - signature verification result, chain verification result
 * - forensics analysis results (stats, not content)
 * 
 * What is NEVER stored:
 * - Raw transcript content
 * - Individual message content
 * - Canonical transcript string
 * 
 * Modes (rendering semantics):
 * - "full": Would return complete transcript IF provided in request (ephemeral)
 * - "redacted": PII-redacted ephemeral rendering
 * - "hidden": No transcript content returned (default safe mode)
 */
export const TRANSCRIPT_MODE_CONTRACT = {
  schema: "transcript-mode-contract/1.1",
  
  /** Mode controls RENDERING only, not storage */
  is_storage_mode: false,
  
  /** Mode controls ephemeral API response rendering */
  is_display_mode: true,
  
  /** Raw transcripts are NEVER persisted */
  raw_transcript_persisted: false,
  
  /** Only integrity proofs (hashes, signatures, chain) are stored */
  integrity_proofs_persisted: true,
  
  /** Transcripts are processed ephemerally for verification */
  ephemeral_processing_only: true,
  
  modes: {
    full: {
      description: "Complete transcript rendered in API response (ephemeral)",
      content_included: true,
      pii_redacted: false,
    },
    redacted: {
      description: "PII-redacted transcript rendered in API response (ephemeral)",
      content_included: true,
      pii_redacted: true,
    },
    hidden: {
      description: "No transcript content in API response (default safe mode)",
      content_included: false,
      pii_redacted: false,
    },
  },
} as const;

// =============================================================================
// PUBLIC VERIFY RESPONSE CONTRACT
// =============================================================================

/**
 * Deterministic response envelope for GET /api/public/receipts/:id/verify
 */
export interface PublicVerifyResponse {
  schema: "ai-receipt/public-verify/1.0";
  receipt_id: string;
  platform: string;
  captured_at: string;
  verified_at: string;
  verification_status: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED";
  kill_switch_engaged: boolean;
  
  integrity: {
    hash_match: boolean;
    computed_hash_sha256: string;
    expected_hash_sha256: string | null;
    receipt_hash_sha256: string | null;
  };
  
  signature: {
    status: "VALID" | "INVALID" | "UNTRUSTED_ISSUER" | "NO_SIGNATURE";
    public_key_id: string | null;
    issuer_id: string | null;
    issuer_label: string | null;
    key_status: string | null;
  };
  
  chain: {
    status: "GENESIS" | "LINKED" | "BROKEN" | "NOT_CHECKED";
    previous_receipt_id: string | null;
    is_genesis: boolean;
  };
  
  transcript: {
    mode: "full" | "redacted" | "hidden";
    included: boolean;
    message_count: number;
    /** 
     * DISPLAY MODE NOTE: 'content' presence is controlled by TRANSCRIPT_MODE.
     * This is a display setting, NOT a storage setting.
     * The transcript is always stored for verification integrity.
     */
    content?: Array<{ role: string; content: string }>;
  };
  
  forensics: {
    schema: string;
    forensics_engine_id: string;
    forensics_ran_at: string;
    detectors_ran: string[];
    based_on: string;
    integrity_context: {
      verification_status: string;
      hash_match: boolean;
    };
    transcript_stats: {
      message_count: number;
      total_chars: number;
      role_distribution: Record<string, number>;
    };
    risk_keywords: {
      found_any: boolean;
      categories_present: string[];
    };
    pii_heuristics: {
      found_any: boolean;
      types_detected: string[];
      total_count: number;
    };
    structural_anomalies: Record<string, boolean>;
    anomalies: {
      high_entropy_blocks: {
        found: boolean;
        count: number;
      };
    };
  } | null;
  
  /** Contract metadata - always present for audit (P6.6 corrected) */
  _contract: {
    /** TRANSCRIPT_MODE is rendering/redaction semantics only */
    transcript_mode_is_display_only: true;
    /** Raw transcripts are NEVER persisted - only integrity proofs */
    raw_transcript_persisted: false;
    /** Integrity proofs (hashes, signatures, chain) are stored */
    integrity_proofs_persisted: true;
    /** LLM observations are excluded from this response */
    observations_excluded: true;
    /** Research data is excluded from this response */
    research_data_excluded: true;
  };
}

// =============================================================================
// PUBLIC VERIFICATION PROOF PACK (P6.7)
// =============================================================================

/**
 * Proof Pack: A compact, machine-verifiable integrity proof for a receipt.
 * 
 * CRITICAL CONTRACT:
 * - NO transcript content (raw_transcript_persisted: false)
 * - NO LLM observations (sensor data is isolated)
 * - NO research data (anonymized exports are separate)
 * - ONLY integrity proofs: hashes, signature result, chain status, key governance
 */
export interface PublicProofPack {
  schema: "ai-receipt/proof-pack/1.0";
  
  /** Receipt identification */
  receipt_id: string;
  platform: string;
  captured_at: string;
  verified_at: string;
  
  /** Final verification status */
  verification_status: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED";
  
  /** Kill switch status */
  kill_switch_engaged: boolean;
  
  /** Integrity proofs (hashes) */
  integrity: {
    hash_match: boolean;
    computed_hash_sha256: string;
    expected_hash_sha256: string;
    receipt_hash_sha256: string;
    canonicalization: "c14n-v1";
  };
  
  /** Signature verification result */
  signature: {
    status: "VALID" | "INVALID" | "UNTRUSTED_ISSUER" | "NO_SIGNATURE";
    algorithm: string | null;
    public_key_id: string | null;
    issuer_id: string | null;
    issuer_label: string | null;
    /** Key governance snapshot at verification time */
    key_governance: {
      key_status: "ACTIVE" | "REVOKED" | "EXPIRED" | null;
      valid_from: string | null;
      valid_to: string | null;
      revoked_reason: string | null;
    };
  };
  
  /** Chain verification result */
  chain: {
    status: "GENESIS" | "LINKED" | "BROKEN" | "NOT_CHECKED";
    previous_receipt_id: string | null;
    previous_receipt_hash: string | null;
    is_genesis: boolean;
    link_verified: boolean;
  };
  
  /** 
   * P7.3: Proof Scope Declaration
   * Explicitly declares what this proof pack proves and does NOT prove.
   * Prevents "proof implies truth" misuse.
   */
  proof_scope: ["integrity", "signature", "chain"];
  proof_scope_excludes: ["truth", "completeness", "authorship_intent"];
  
  /** Contract metadata - always present */
  _contract: {
    proof_pack_version: "1.0";
    transcript_included: false;
    observations_included: false;
    research_data_included: false;
    integrity_proofs_only: true;
  };
}

// =============================================================================
// RATE LIMIT HEADERS CONTRACT
// =============================================================================

/**
 * Rate limit headers to include in responses.
 */
export interface RateLimitHeaders {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
}

export function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetMs: number,
  retryAfterMs?: number
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
  };
  
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  }
  
  return headers;
}

// =============================================================================
// HTTP STATUS CODE MAPPING
// =============================================================================

export const ERROR_CODE_TO_HTTP_STATUS: Record<PublicErrorCode, number> = {
  RECEIPT_NOT_FOUND: 404,
  INVALID_RECEIPT_ID: 400,
  INVALID_REQUEST_BODY: 400,
  MISSING_REQUIRED_FIELD: 400,
  RATE_LIMIT_EXCEEDED: 429,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PAYLOAD_TOO_LARGE: 413,
  KILL_SWITCH_ENGAGED: 403,
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};
