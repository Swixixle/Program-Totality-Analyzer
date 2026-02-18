import { describe, it, expect, beforeAll } from "vitest";
import {
  generateTenantKeyPair,
  hashAnalysisContent,
  createCanonicalMessage,
  signMessage,
  verifySignature,
  generateEvidenceBundle,
  verifyEvidenceBundle,
  type EvidenceBundleOptions,
} from "../evidence-bundle";
import type { Analysis } from "@shared/schema";

describe("Evidence Bundle Service", () => {
  let tenantKeys: { privateKey: string; publicKey: string };
  let mockAnalysis: Analysis;

  beforeAll(() => {
    // Generate test keys
    tenantKeys = generateTenantKeyPair();

    // Create mock analysis data
    mockAnalysis = {
      id: 1,
      projectId: 1,
      dossier: "# Test Dossier\n\nThis is a test dossier with some content.",
      claims: [
        { statement: "Test claim 1", confidence: 0.95 },
        { statement: "Test claim 2", confidence: 0.85 },
      ] as any,
      operate: {
        boot: { commands: ["npm install", "npm start"] },
        integrate: { endpoints: ["/api/test"] },
        deploy: { docker: true },
        readiness: { score: 85 },
      } as any,
      coverage: { scanned: 100, skipped: 5 } as any,
      unknowns: [] as any,
      createdAt: new Date(),
    };
  });

  describe("Key Generation", () => {
    it("should generate RSA key pair", () => {
      const keys = generateTenantKeyPair();
      expect(keys.privateKey).toContain("BEGIN PRIVATE KEY");
      expect(keys.publicKey).toContain("BEGIN PUBLIC KEY");
    });

    it("should generate different keys each time", () => {
      const keys1 = generateTenantKeyPair();
      const keys2 = generateTenantKeyPair();
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
      expect(keys1.publicKey).not.toBe(keys2.publicKey);
    });
  });

  describe("Content Hashing", () => {
    it("should hash analysis content consistently", () => {
      const hash1 = hashAnalysisContent(mockAnalysis);
      const hash2 = hashAnalysisContent(mockAnalysis);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it("should produce different hashes for different content", () => {
      const analysis2 = { ...mockAnalysis, dossier: "Different content" };
      const hash1 = hashAnalysisContent(mockAnalysis);
      const hash2 = hashAnalysisContent(analysis2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Canonical Message", () => {
    it("should create canonical message with required fields", () => {
      const partialBundle = {
        certificate_id: "test-cert-id",
        tenant_id: "test-tenant",
        analysis_id: 1,
        issued_at_utc: "2024-01-01T00:00:00.000Z",
        hashes: {
          note_hash: "abc123",
          hash_algorithm: "sha256",
        },
      };

      const canonical = createCanonicalMessage(partialBundle);
      expect(canonical).toContain("test-cert-id");
      expect(canonical).toContain("test-tenant");
      expect(canonical).toContain("abc123");
    });

    it("should produce deterministic output", () => {
      const bundle = {
        certificate_id: "test-cert-id",
        tenant_id: "test-tenant",
        analysis_id: 1,
        issued_at_utc: "2024-01-01T00:00:00.000Z",
        hashes: {
          note_hash: "abc123",
          hash_algorithm: "sha256",
        },
      };

      const canonical1 = createCanonicalMessage(bundle);
      const canonical2 = createCanonicalMessage(bundle);
      expect(canonical1).toBe(canonical2);
    });
  });

  describe("Signature Operations", () => {
    it("should sign and verify a message", () => {
      const message = "test message";
      const signature = signMessage(message, tenantKeys.privateKey);
      expect(signature).toBeTruthy();
      expect(signature.length).toBeGreaterThan(0);

      const valid = verifySignature(message, signature, tenantKeys.publicKey);
      expect(valid).toBe(true);
    });

    it("should fail verification with wrong signature", () => {
      const message = "test message";
      const signature = signMessage(message, tenantKeys.privateKey);
      
      // Modify signature
      const tamperedSignature = signature.slice(0, -4) + "XXXX";
      const valid = verifySignature(message, tamperedSignature, tenantKeys.publicKey);
      expect(valid).toBe(false);
    });

    it("should fail verification with wrong message", () => {
      const message = "test message";
      const signature = signMessage(message, tenantKeys.privateKey);
      
      const valid = verifySignature("different message", signature, tenantKeys.publicKey);
      expect(valid).toBe(false);
    });

    it("should fail verification with wrong public key", () => {
      const message = "test message";
      const signature = signMessage(message, tenantKeys.privateKey);
      
      const differentKeys = generateTenantKeyPair();
      const valid = verifySignature(message, signature, differentKeys.publicKey);
      expect(valid).toBe(false);
    });
  });

  describe("Evidence Bundle Generation", () => {
    it("should generate complete evidence bundle", () => {
      const certificateId = "test-cert-123";
      const options: EvidenceBundleOptions = {
        analysisId: 1,
        tenantId: "test-tenant",
        analysis: mockAnalysis,
        modelVersion: "gpt-4",
        promptVersion: "v1.0",
        governancePolicyVersion: "policy-v1",
        humanReviewed: true,
        reviewerHash: "reviewer123",
        ehrReferencedAt: "2024-01-01T00:00:00Z",
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        tenantKeys.privateKey,
        tenantKeys.publicKey
      );

      // Verify structure
      expect(bundle.certificate_id).toBe(certificateId);
      expect(bundle.tenant_id).toBe("test-tenant");
      expect(bundle.analysis_id).toBe(1);
      expect(bundle.issued_at_utc).toBeTruthy();

      // Verify signature object
      expect(bundle.signature.algorithm).toBe("RSA-SHA256");
      expect(bundle.signature.key_id).toBeTruthy();
      expect(bundle.signature.signature).toBeTruthy();
      expect(bundle.signature.canonical_message).toBeTruthy();

      // Verify hashes
      expect(bundle.hashes.note_hash).toBeTruthy();
      expect(bundle.hashes.hash_algorithm).toBe("sha256");

      // Verify model info
      expect(bundle.model_info.model_version).toBe("gpt-4");
      expect(bundle.model_info.prompt_version).toBe("v1.0");
      expect(bundle.model_info.governance_policy_version).toBe("policy-v1");
      expect(bundle.model_info.policy_hash).toBeTruthy();

      // Verify human attestation
      expect(bundle.human_attestation.human_reviewed).toBe(true);
      expect(bundle.human_attestation.reviewer_hash).toBe("reviewer123");
      expect(bundle.human_attestation.ehr_referenced_at).toBe("2024-01-01T00:00:00Z");

      // Verify verification instructions
      expect(bundle.verification_instructions.steps).toBeTruthy();
      expect(bundle.verification_instructions.steps.length).toBeGreaterThan(0);

      // Verify public key
      expect(bundle.public_key_pem).toBe(tenantKeys.publicKey);

      // Verify analysis data
      expect(bundle.analysis_data.dossier_excerpt).toContain("Test Dossier");
      expect(bundle.analysis_data.claims_count).toBe(2);
      expect(bundle.analysis_data.coverage_summary).toBeTruthy();
      expect(bundle.analysis_data.operate_summary).toBeTruthy();
    });

    it("should generate bundle with minimal options", () => {
      const certificateId = "test-cert-456";
      const options: EvidenceBundleOptions = {
        analysisId: 1,
        tenantId: "test-tenant",
        analysis: mockAnalysis,
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        tenantKeys.privateKey,
        tenantKeys.publicKey
      );

      expect(bundle.certificate_id).toBe(certificateId);
      expect(bundle.model_info.model_version).toBeNull();
      expect(bundle.model_info.prompt_version).toBeNull();
      expect(bundle.human_attestation.human_reviewed).toBe(false);
    });
  });

  describe("Evidence Bundle Verification", () => {
    it("should verify a valid bundle", () => {
      const certificateId = "test-cert-789";
      const options: EvidenceBundleOptions = {
        analysisId: 1,
        tenantId: "test-tenant",
        analysis: mockAnalysis,
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        tenantKeys.privateKey,
        tenantKeys.publicKey
      );

      const result = verifyEvidenceBundle(bundle);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject bundle with tampered signature", () => {
      const certificateId = "test-cert-tampered";
      const options: EvidenceBundleOptions = {
        analysisId: 1,
        tenantId: "test-tenant",
        analysis: mockAnalysis,
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        tenantKeys.privateKey,
        tenantKeys.publicKey
      );

      // Tamper with signature
      bundle.signature.signature = "invalid-signature";

      const result = verifyEvidenceBundle(bundle);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Signature verification failed");
    });

    it("should reject bundle with tampered canonical message", () => {
      const certificateId = "test-cert-tampered-canonical";
      const options: EvidenceBundleOptions = {
        analysisId: 1,
        tenantId: "test-tenant",
        analysis: mockAnalysis,
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        tenantKeys.privateKey,
        tenantKeys.publicKey
      );

      // Tamper with canonical message
      bundle.signature.canonical_message = '{"certificate_id":"different"}';

      const result = verifyEvidenceBundle(bundle);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject bundle with mismatched key_id", () => {
      const certificateId = "test-cert-key-mismatch";
      const options: EvidenceBundleOptions = {
        analysisId: 1,
        tenantId: "test-tenant",
        analysis: mockAnalysis,
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        tenantKeys.privateKey,
        tenantKeys.publicKey
      );

      // Tamper with key_id
      bundle.signature.key_id = "wrong-key-id";

      const result = verifyEvidenceBundle(bundle);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Key ID does not match public key");
    });

    it("should reject bundle with tampered certificate_id", () => {
      const certificateId = "test-cert-tampered-id";
      const options: EvidenceBundleOptions = {
        analysisId: 1,
        tenantId: "test-tenant",
        analysis: mockAnalysis,
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        tenantKeys.privateKey,
        tenantKeys.publicKey
      );

      // Tamper with certificate_id
      bundle.certificate_id = "different-id";

      const result = verifyEvidenceBundle(bundle);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Canonical message does not match bundle data");
    });
  });

  describe("End-to-End Workflow", () => {
    it("should create, sign, and verify complete workflow", () => {
      // Step 1: Generate tenant keys
      const keys = generateTenantKeyPair();

      // Step 2: Create evidence bundle
      const certificateId = "e2e-test-cert";
      const options: EvidenceBundleOptions = {
        analysisId: 42,
        tenantId: "hospital-abc",
        analysis: mockAnalysis,
        modelVersion: "gpt-4-turbo",
        promptVersion: "v2.1",
        governancePolicyVersion: "hipaa-compliant-v1",
        humanReviewed: true,
        reviewerHash: "dr-smith-sha256-hash",
        ehrReferencedAt: "2024-12-15T14:30:00Z",
      };

      const bundle = generateEvidenceBundle(
        certificateId,
        options,
        keys.privateKey,
        keys.publicKey
      );

      // Step 3: Verify the bundle
      const verification = verifyEvidenceBundle(bundle);
      expect(verification.valid).toBe(true);
      expect(verification.errors).toHaveLength(0);

      // Step 4: Verify offline (simulated - using just public key)
      const signatureValid = verifySignature(
        bundle.signature.canonical_message,
        bundle.signature.signature,
        bundle.public_key_pem
      );
      expect(signatureValid).toBe(true);

      // Step 5: Verify content hash
      const contentHash = hashAnalysisContent(mockAnalysis);
      expect(contentHash).toBe(bundle.hashes.note_hash);
    });
  });
});
