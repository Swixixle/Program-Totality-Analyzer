/**
 * P7.5 Security Audit Events
 * 
 * Logs security-relevant events to forensic log without leaking sensitive data.
 * Events are logged with stable codes and hashed identifiers only.
 */

import { appendEvent } from "./forensic-log";
import { createHash } from "crypto";

// Security event types
export type SecurityEventType = 
  | "SECURITY_AUTH_FAILURE"
  | "SECURITY_RATE_EXCEEDED"
  | "SECURITY_PAYLOAD_REJECTED"
  | "SECURITY_FORBIDDEN_WORDS"
  | "SECURITY_KILL_SWITCH"
  | "SECURITY_PROMPT_INJECTION_FLAG";

/**
 * Hash an IP address to avoid storing raw IPs in audit logs
 */
function hashIp(ip: string): string {
  return createHash("sha256")
    .update(ip + process.env.SESSION_SECRET || "audit-salt")
    .digest("hex")
    .substring(0, 8); // First 8 chars only
}

/**
 * Log authentication failure (401/403)
 */
export function logAuthFailure(
  endpoint: string,
  ip: string,
  errorCode: string,
  httpStatus: number
): void {
  appendEvent({
    event_type: "SECURITY_AUTH_FAILURE",
    summary: JSON.stringify({
      endpoint,
      ip_hash: hashIp(ip),
      error_code: errorCode,
      http_status: httpStatus,
    }),
    evidence_ptrs: ["server/security-audit.ts"],
  });
}

/**
 * Log rate limit exceeded (429)
 */
export function logRateLimitExceeded(
  endpoint: string,
  ip: string,
  limitType: "burst" | "sustained"
): void {
  appendEvent({
    event_type: "SECURITY_RATE_EXCEEDED",
    summary: JSON.stringify({
      endpoint,
      ip_hash: hashIp(ip),
      limit_type: limitType,
    }),
    evidence_ptrs: ["server/security-audit.ts"],
  });
}

/**
 * Log payload size rejection (413)
 */
export function logPayloadRejected(
  endpoint: string,
  sizeBytes: number,
  limitBytes: number
): void {
  appendEvent({
    event_type: "SECURITY_PAYLOAD_REJECTED",
    summary: JSON.stringify({
      endpoint,
      size_bytes: sizeBytes,
      limit_bytes: limitBytes,
    }),
    evidence_ptrs: ["server/security-audit.ts"],
  });
}

/**
 * Log forbidden words rejection in LLM output
 */
export function logForbiddenWords(
  observationType: string,
  wordCount: number,
  receiptId?: string
): void {
  appendEvent({
    event_type: "SECURITY_FORBIDDEN_WORDS",
    summary: JSON.stringify({
      observation_type: observationType,
      word_count: wordCount,
      // Only include receipt_id if synthetic pattern
      ...(receiptId && /^(p[0-9]+-|test-|sample-|mock-|synthetic-)/.test(receiptId) 
        ? { receipt_id: receiptId } 
        : {}),
    }),
    evidence_ptrs: ["server/security-audit.ts"],
  });
}

/**
 * Log kill switch engagement
 */
export function logKillSwitch(receiptId: string): void {
  appendEvent({
    event_type: "SECURITY_KILL_SWITCH",
    summary: JSON.stringify({
      // Only include receipt_id if synthetic pattern
      receipt_id: /^(p[0-9]+-|test-|sample-|mock-|synthetic-)/.test(receiptId)
        ? receiptId
        : "[REDACTED]",
    }),
    evidence_ptrs: ["server/security-audit.ts"],
  });
}

/**
 * P7.4: Log prompt injection attempt detected (non-blocking flag)
 * This is informational only - verification is NOT blocked
 */
export function logPromptInjectionFlag(
  receiptId: string,
  patternMatched: string,
  observationType: string
): void {
  appendEvent({
    event_type: "SECURITY_PROMPT_INJECTION_FLAG",
    summary: JSON.stringify({
      pattern_type: patternMatched,
      observation_type: observationType,
      // Only include receipt_id if synthetic pattern
      ...(receiptId && /^(p[0-9]+-|test-|sample-|mock-|synthetic-)/.test(receiptId) 
        ? { receipt_id: receiptId } 
        : {}),
    }),
    evidence_ptrs: ["server/security-audit.ts"],
  });
}

// P7.4: Prompt injection patterns to flag (non-blocking)
const INJECTION_PATTERNS = [
  /ignore\s+(your\s+)?(previous\s+)?rules/i,
  /ignore\s+(your\s+)?instructions/i,
  /you\s+are\s+now/i,
  /forget\s+(your\s+|all\s+)?(previous\s+)?instructions/i,
  /disregard\s+(your\s+)?(previous\s+)?instructions/i,
  /override\s+(your\s+)?programming/i,
  /tell\s+me\s+(the\s+)?(most\s+)?accurate/i,
  /which\s+(model|answer|response)\s+is\s+(correct|right|best)/i,
  /rank\s+(the\s+)?models/i,
  /which\s+is\s+(more\s+)?truthful/i,
];

/**
 * P7.4: Detect prompt injection attempts in transcript
 * Returns array of matched patterns (for flagging only, never blocking)
 */
export function detectPromptInjection(transcript: string): string[] {
  const matches: string[] = [];
  
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(transcript)) {
      matches.push(pattern.source);
    }
  }
  
  return matches;
}
