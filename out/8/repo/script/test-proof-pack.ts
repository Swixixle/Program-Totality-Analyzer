#!/usr/bin/env tsx
/**
 * P6.7 Public Verification Proof Pack Tests
 * 
 * Validates:
 * - Proof pack schema structure
 * - Contract metadata (no transcript, no observations, no research data)
 * - Integrity proofs only
 * - Key governance snapshot fields
 * - Chain verification fields
 */

import { type PublicProofPack } from "../shared/public-contract";

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
    toBeDefined() {
      if (value === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeOneOf(expected: any[]) {
      if (!expected.includes(value)) {
        throw new Error(`Expected ${value} to be one of ${JSON.stringify(expected)}`);
      }
    },
    not: {
      toBeDefined() {
        if (value !== undefined) {
          throw new Error(`Expected value to be undefined`);
        }
      },
    }
  };
}

// Mock proof pack for schema testing
function createMockProofPack(overrides: Partial<any> = {}): PublicProofPack {
  return {
    schema: "ai-receipt/proof-pack/1.0",
    receipt_id: "test-receipt-123",
    platform: "test-platform",
    captured_at: "2024-01-01T00:00:00Z",
    verified_at: "2024-01-01T00:01:00Z",
    verification_status: "VERIFIED",
    kill_switch_engaged: false,
    integrity: {
      hash_match: true,
      computed_hash_sha256: "abc123...",
      expected_hash_sha256: "abc123...",
      receipt_hash_sha256: "def456...",
      canonicalization: "c14n-v1",
    },
    signature: {
      status: "VALID",
      algorithm: "Ed25519",
      public_key_id: "test-key-001",
      issuer_id: "test-issuer",
      issuer_label: "Test Issuer",
      key_governance: {
        key_status: "ACTIVE",
        valid_from: "2024-01-01T00:00:00Z",
        valid_to: null,
        revoked_reason: null,
      },
    },
    chain: {
      status: "GENESIS",
      previous_receipt_id: null,
      previous_receipt_hash: null,
      is_genesis: true,
      link_verified: true,
    },
    _contract: {
      proof_pack_version: "1.0",
      transcript_included: false,
      observations_included: false,
      research_data_included: false,
      integrity_proofs_only: true,
    },
    ...overrides,
  };
}

async function runTests() {
  console.log("=== P6.7 Proof Pack Tests ===\n");

  console.log("--- Schema Structure Tests ---");

  await test("Proof pack should have correct schema version", () => {
    const pack = createMockProofPack();
    expect(pack.schema).toBe("ai-receipt/proof-pack/1.0");
  });

  await test("Proof pack should have receipt identification fields", () => {
    const pack = createMockProofPack();
    expect(pack.receipt_id).toBeDefined();
    expect(pack.platform).toBeDefined();
    expect(pack.captured_at).toBeDefined();
    expect(pack.verified_at).toBeDefined();
  });

  await test("Verification status should be valid enum", () => {
    const pack = createMockProofPack();
    expect(pack.verification_status).toBeOneOf(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED"]);
  });

  console.log("\n--- Contract Metadata Tests ---");

  await test("Contract should declare NO transcript included", () => {
    const pack = createMockProofPack();
    expect(pack._contract.transcript_included).toBe(false);
  });

  await test("Contract should declare NO observations included", () => {
    const pack = createMockProofPack();
    expect(pack._contract.observations_included).toBe(false);
  });

  await test("Contract should declare NO research data included", () => {
    const pack = createMockProofPack();
    expect(pack._contract.research_data_included).toBe(false);
  });

  await test("Contract should declare integrity proofs only", () => {
    const pack = createMockProofPack();
    expect(pack._contract.integrity_proofs_only).toBe(true);
  });

  await test("Contract should have proof pack version", () => {
    const pack = createMockProofPack();
    expect(pack._contract.proof_pack_version).toBe("1.0");
  });

  console.log("\n--- Integrity Proofs Tests ---");

  await test("Integrity should have hash match indicator", () => {
    const pack = createMockProofPack();
    expect(pack.integrity.hash_match).toBeDefined();
  });

  await test("Integrity should have computed hash", () => {
    const pack = createMockProofPack();
    expect(pack.integrity.computed_hash_sha256).toBeDefined();
  });

  await test("Integrity should have expected hash", () => {
    const pack = createMockProofPack();
    expect(pack.integrity.expected_hash_sha256).toBeDefined();
  });

  await test("Integrity should have receipt hash", () => {
    const pack = createMockProofPack();
    expect(pack.integrity.receipt_hash_sha256).toBeDefined();
  });

  await test("Integrity should specify canonicalization", () => {
    const pack = createMockProofPack();
    expect(pack.integrity.canonicalization).toBe("c14n-v1");
  });

  console.log("\n--- Signature Verification Tests ---");

  await test("Signature should have status", () => {
    const pack = createMockProofPack();
    expect(pack.signature.status).toBeOneOf(["VALID", "INVALID", "UNTRUSTED_ISSUER", "NO_SIGNATURE"]);
  });

  await test("Signature should have key governance snapshot", () => {
    const pack = createMockProofPack();
    expect(pack.signature.key_governance).toBeDefined();
    expect(pack.signature.key_governance.key_status).toBeOneOf(["ACTIVE", "REVOKED", "EXPIRED", null]);
  });

  console.log("\n--- Chain Verification Tests ---");

  await test("Chain should have status", () => {
    const pack = createMockProofPack();
    expect(pack.chain.status).toBeOneOf(["GENESIS", "LINKED", "BROKEN", "NOT_CHECKED"]);
  });

  await test("Chain should have genesis indicator", () => {
    const pack = createMockProofPack();
    expect(pack.chain.is_genesis).toBeDefined();
  });

  await test("Chain should have link verified indicator", () => {
    const pack = createMockProofPack();
    expect(pack.chain.link_verified).toBeDefined();
  });

  console.log("\n--- Verification Status Path Tests ---");

  await test("VERIFIED status should have hash_match=true and valid signature", () => {
    const pack = createMockProofPack({
      verification_status: "VERIFIED",
      integrity: { hash_match: true, computed_hash_sha256: "a", expected_hash_sha256: "a", receipt_hash_sha256: "b", canonicalization: "c14n-v1" },
      signature: { status: "VALID", algorithm: "Ed25519", public_key_id: "k", issuer_id: "i", issuer_label: "l", key_governance: { key_status: "ACTIVE", valid_from: null, valid_to: null, revoked_reason: null } },
    });
    expect(pack.verification_status).toBe("VERIFIED");
    expect(pack.integrity.hash_match).toBe(true);
    expect(pack.signature.status).toBe("VALID");
  });

  await test("PARTIALLY_VERIFIED status should allow untrusted issuer", () => {
    const pack = createMockProofPack({
      verification_status: "PARTIALLY_VERIFIED",
      integrity: { hash_match: true, computed_hash_sha256: "a", expected_hash_sha256: "a", receipt_hash_sha256: "b", canonicalization: "c14n-v1" },
      signature: { status: "UNTRUSTED_ISSUER", algorithm: "Ed25519", public_key_id: "k", issuer_id: null, issuer_label: null, key_governance: { key_status: null, valid_from: null, valid_to: null, revoked_reason: null } },
    });
    expect(pack.verification_status).toBe("PARTIALLY_VERIFIED");
    expect(pack.signature.status).toBe("UNTRUSTED_ISSUER");
  });

  await test("UNVERIFIED status for hash mismatch", () => {
    const pack = createMockProofPack({
      verification_status: "UNVERIFIED",
      integrity: { hash_match: false, computed_hash_sha256: "a", expected_hash_sha256: "b", receipt_hash_sha256: "c", canonicalization: "c14n-v1" },
    });
    expect(pack.verification_status).toBe("UNVERIFIED");
    expect(pack.integrity.hash_match).toBe(false);
  });

  await test("UNVERIFIED status for invalid signature", () => {
    const pack = createMockProofPack({
      verification_status: "UNVERIFIED",
      signature: { status: "INVALID", algorithm: "Ed25519", public_key_id: "k", issuer_id: "i", issuer_label: "l", key_governance: { key_status: "ACTIVE", valid_from: null, valid_to: null, revoked_reason: null } },
    });
    expect(pack.verification_status).toBe("UNVERIFIED");
    expect(pack.signature.status).toBe("INVALID");
  });

  await test("UNVERIFIED status for broken chain", () => {
    const pack = createMockProofPack({
      verification_status: "UNVERIFIED",
      chain: { status: "BROKEN", previous_receipt_id: "prev", previous_receipt_hash: "hash", is_genesis: false, link_verified: false },
    });
    expect(pack.verification_status).toBe("UNVERIFIED");
    expect(pack.chain.status).toBe("BROKEN");
    expect(pack.chain.link_verified).toBe(false);
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
