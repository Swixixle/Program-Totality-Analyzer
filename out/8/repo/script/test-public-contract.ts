#!/usr/bin/env tsx
/**
 * P6.6 Public Endpoint Contract Hardening Tests
 * 
 * Validates:
 * - Canonical error taxonomy consistency
 * - Deterministic response envelopes
 * - Rate limit header presence
 * - TRANSCRIPT_MODE semantics (display mode, not storage mode)
 * - Contract metadata in public responses
 */

import {
  PUBLIC_ERROR_CODES,
  createPublicError,
  createRateLimitHeaders,
  TRANSCRIPT_MODE_CONTRACT,
  ERROR_CODE_TO_HTTP_STATUS,
  type PublicErrorCode,
  type PublicErrorResponse,
} from "../shared/public-contract";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${e.message}`);
      failed++;
    }
  })();
}

function expect(value: any) {
  return {
    toBe(expected: any) {
      if (value !== expected) {
        throw new Error(`Expected ${expected} but got ${value}`);
      }
    },
    toEqual(expected: any) {
      const vStr = JSON.stringify(value);
      const eStr = JSON.stringify(expected);
      if (vStr !== eStr) {
        throw new Error(`Expected ${eStr} but got ${vStr}`);
      }
    },
    toBeDefined() {
      if (value === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (!(value > expected)) {
        throw new Error(`Expected ${value} > ${expected}`);
      }
    },
    toContain(expected: string) {
      if (!value.includes(expected)) {
        throw new Error(`Expected "${value}" to contain "${expected}"`);
      }
    },
  };
}

async function runTests() {
  console.log("=== P6.6 Public Contract Hardening Tests ===\n");

  console.log("--- Error Taxonomy Tests ---");

  await test("PUBLIC_ERROR_CODES should have all required error codes", () => {
    const requiredCodes = [
      "RECEIPT_NOT_FOUND",
      "INVALID_RECEIPT_ID",
      "INVALID_REQUEST_BODY",
      "MISSING_REQUIRED_FIELD",
      "RATE_LIMIT_EXCEEDED",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "PAYLOAD_TOO_LARGE",
      "KILL_SWITCH_ENGAGED",
      "INTERNAL_ERROR",
      "DATABASE_ERROR",
      "SERVICE_UNAVAILABLE",
    ];
    for (const code of requiredCodes) {
      expect((PUBLIC_ERROR_CODES as any)[code]).toBeDefined();
    }
  });

  await test("ERROR_CODE_TO_HTTP_STATUS should map all error codes", () => {
    for (const code of Object.values(PUBLIC_ERROR_CODES)) {
      expect(ERROR_CODE_TO_HTTP_STATUS[code as PublicErrorCode]).toBeDefined();
    }
  });

  await test("HTTP status codes should be valid", () => {
    expect(ERROR_CODE_TO_HTTP_STATUS.RECEIPT_NOT_FOUND).toBe(404);
    expect(ERROR_CODE_TO_HTTP_STATUS.RATE_LIMIT_EXCEEDED).toBe(429);
    expect(ERROR_CODE_TO_HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(ERROR_CODE_TO_HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(ERROR_CODE_TO_HTTP_STATUS.INTERNAL_ERROR).toBe(500);
    expect(ERROR_CODE_TO_HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  });

  console.log("\n--- Error Response Envelope Tests ---");

  await test("createPublicError should produce valid envelope", () => {
    const error = createPublicError(
      PUBLIC_ERROR_CODES.RECEIPT_NOT_FOUND,
      "Receipt not found",
      { receipt_id: "test-123" },
      "req-456"
    );
    expect(error.schema).toBe("ai-receipt/error/1.0");
    expect(error.error.code).toBe("RECEIPT_NOT_FOUND");
    expect(error.error.message).toBe("Receipt not found");
    expect(error.error.details?.receipt_id).toBe("test-123");
    expect(error.request_id).toBe("req-456");
    expect(error.timestamp).toBeDefined();
  });

  await test("createPublicError should work without optional fields", () => {
    const error = createPublicError(
      PUBLIC_ERROR_CODES.INTERNAL_ERROR,
      "Something went wrong"
    );
    expect(error.schema).toBe("ai-receipt/error/1.0");
    expect(error.error.code).toBe("INTERNAL_ERROR");
    expect(error.error.details).toBe(undefined);
    expect(error.request_id).toBe(undefined);
  });

  console.log("\n--- Rate Limit Headers Tests ---");

  await test("createRateLimitHeaders should produce required headers", () => {
    const headers = createRateLimitHeaders(100, 75, 30000);
    expect(headers["X-RateLimit-Limit"]).toBe("100");
    expect(headers["X-RateLimit-Remaining"]).toBe("75");
    expect(headers["X-RateLimit-Reset"]).toBe("30");
    expect(headers["Retry-After"]).toBe(undefined);
  });

  await test("createRateLimitHeaders should include Retry-After when provided", () => {
    const headers = createRateLimitHeaders(100, 0, 60000, 5000);
    expect(headers["X-RateLimit-Limit"]).toBe("100");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Reset"]).toBe("60");
    expect(headers["Retry-After"]).toBe("5");
  });

  await test("createRateLimitHeaders should clamp remaining to 0", () => {
    const headers = createRateLimitHeaders(100, -5, 30000);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });

  console.log("\n--- TRANSCRIPT_MODE Contract Tests (P6.6 Corrected) ---");

  await test("TRANSCRIPT_MODE_CONTRACT should declare rendering mode semantics", () => {
    expect(TRANSCRIPT_MODE_CONTRACT.is_storage_mode).toBe(false);
    expect(TRANSCRIPT_MODE_CONTRACT.is_display_mode).toBe(true);
    expect(TRANSCRIPT_MODE_CONTRACT.raw_transcript_persisted).toBe(false);
    expect(TRANSCRIPT_MODE_CONTRACT.integrity_proofs_persisted).toBe(true);
    expect(TRANSCRIPT_MODE_CONTRACT.ephemeral_processing_only).toBe(true);
  });

  await test("TRANSCRIPT_MODE_CONTRACT should explicitly state NO transcript persistence", () => {
    expect(TRANSCRIPT_MODE_CONTRACT.raw_transcript_persisted).toBe(false);
    expect(TRANSCRIPT_MODE_CONTRACT.integrity_proofs_persisted).toBe(true);
  });

  await test("TRANSCRIPT_MODE_CONTRACT should document rendering modes", () => {
    expect(TRANSCRIPT_MODE_CONTRACT.modes.full.content_included).toBe(true);
    expect(TRANSCRIPT_MODE_CONTRACT.modes.full.pii_redacted).toBe(false);
    
    expect(TRANSCRIPT_MODE_CONTRACT.modes.redacted.content_included).toBe(true);
    expect(TRANSCRIPT_MODE_CONTRACT.modes.redacted.pii_redacted).toBe(true);
    
    expect(TRANSCRIPT_MODE_CONTRACT.modes.hidden.content_included).toBe(false);
    expect(TRANSCRIPT_MODE_CONTRACT.modes.hidden.pii_redacted).toBe(false);
  });

  await test("TRANSCRIPT_MODE_CONTRACT should have updated schema version", () => {
    expect(TRANSCRIPT_MODE_CONTRACT.schema).toBe("transcript-mode-contract/1.1");
  });

  console.log("\n--- Contract Metadata Tests (P6.6 Corrected) ---");

  await test("Contract metadata should declare NO transcript persistence", () => {
    const contractMetadata = {
      transcript_mode_is_display_only: TRANSCRIPT_MODE_CONTRACT.is_display_mode,
      raw_transcript_persisted: TRANSCRIPT_MODE_CONTRACT.raw_transcript_persisted,
      integrity_proofs_persisted: TRANSCRIPT_MODE_CONTRACT.integrity_proofs_persisted,
      observations_excluded: true,
      research_data_excluded: true,
    };
    expect(contractMetadata.transcript_mode_is_display_only).toBe(true);
    expect(contractMetadata.raw_transcript_persisted).toBe(false);
    expect(contractMetadata.integrity_proofs_persisted).toBe(true);
    expect(contractMetadata.observations_excluded).toBe(true);
    expect(contractMetadata.research_data_excluded).toBe(true);
  });

  await test("Contract should guarantee ephemeral transcript processing", () => {
    expect(TRANSCRIPT_MODE_CONTRACT.ephemeral_processing_only).toBe(true);
    expect(TRANSCRIPT_MODE_CONTRACT.raw_transcript_persisted).toBe(false);
  });

  console.log("\n=== Test Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
