import { describe, it, expect, beforeEach } from "vitest";
import {
  LogOnlyAnchor,
  S3WormAnchor,
  Rfc3161TsaAnchor,
  MultiAnchor,
  buildAnchorPayload,
  computeAnchorHash,
  type AnchorReceipt,
} from "../checkpoint-anchor";
import {
  buildCheckpointPayload,
  signCheckpoint,
} from "../checkpoint-signer";
import { sha256Hex, stableStringifyStrict } from "../audit-canon";

function makeTestCheckpoint(seq: number = 5) {
  const cpPayload = buildCheckpointPayload(
    seq,
    sha256Hex(`test-hash-${seq}`),
    seq,
    null,
    null,
  );
  return signCheckpoint(cpPayload);
}

describe("Anchor Integration Tests", () => {
  const engineId = "test-engine/1.0.0";
  const auditPayloadVersion = 1;

  describe("anchor_hash integrity", () => {
    it("log-only: anchor_hash matches recomputed hash", async () => {
      const anchor = new LogOnlyAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const recomputed = computeAnchorHash(receipt.anchorPayload);
      expect(receipt.anchorHash).toBe(recomputed);
    });

    it("s3-worm: anchor_hash matches recomputed hash", async () => {
      const anchor = new S3WormAnchor("test-bucket", "prefix/", 30);
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const recomputed = computeAnchorHash(receipt.anchorPayload);
      expect(receipt.anchorHash).toBe(recomputed);
    });

    it("rfc3161: anchor_hash matches recomputed hash", async () => {
      const anchor = new Rfc3161TsaAnchor("https://test-tsa.example.com/tsr");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const recomputed = computeAnchorHash(receipt.anchorPayload);
      expect(receipt.anchorHash).toBe(recomputed);
    });
  });

  describe("verify detects tampered anchor_hash", () => {
    it("log-only: fails on tampered anchor_hash", async () => {
      const anchor = new LogOnlyAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const tampered: AnchorReceipt = { ...receipt, anchorHash: "0000000000000000000000000000000000000000000000000000000000000000" };
      const result = await anchor.verify(tampered);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("anchor_hash mismatch");
    });

    it("s3-worm: fails on tampered anchor_hash", async () => {
      const anchor = new S3WormAnchor("test-bucket");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const tampered: AnchorReceipt = { ...receipt, anchorHash: "bad" + receipt.anchorHash.slice(3) };
      const result = await anchor.verify(tampered);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("anchor_hash mismatch");
    });

    it("rfc3161: fails on tampered anchor_hash", async () => {
      const anchor = new Rfc3161TsaAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const tampered: AnchorReceipt = { ...receipt, anchorHash: "ffff" + receipt.anchorHash.slice(4) };
      const result = await anchor.verify(tampered);
      expect(result.valid).toBe(false);
    });
  });

  describe("S3 WORM specific verifications", () => {
    it("objectBody is included in proof and matches objectHash", async () => {
      const anchor = new S3WormAnchor("test-bucket", "cp/", 90, "GOVERNANCE");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const proof = receipt.proof as any;
      expect(proof.objectBody).toBeDefined();
      expect(proof.objectHash).toBeDefined();

      const recomputedObjectHash = sha256Hex(proof.objectBody);
      expect(recomputedObjectHash).toBe(proof.objectHash);
    });

    it("objectBody contains anchor_hash matching receipt", async () => {
      const anchor = new S3WormAnchor("test-bucket");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const proof = receipt.proof as any;
      const parsed = JSON.parse(proof.objectBody);
      expect(parsed.anchor_hash).toBe(receipt.anchorHash);
    });

    it("verify detects objectHash mismatch", async () => {
      const anchor = new S3WormAnchor("test-bucket");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const tampered: AnchorReceipt = {
        ...receipt,
        proof: {
          ...receipt.proof,
          objectHash: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      };
      const result = await anchor.verify(tampered);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("object hash mismatch");
    });

    it("retentionMode and crossAccountId in proof", async () => {
      const anchor = new S3WormAnchor("audit-bucket", "anchors/", 365, "COMPLIANCE", "123456789012");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const proof = receipt.proof as any;
      expect(proof.retentionMode).toBe("COMPLIANCE");
      expect(proof.crossAccountId).toBe("123456789012");
      expect(proof.retentionDays).toBe(365);
    });

    it("config exposes bucket and retention settings", () => {
      const anchor = new S3WormAnchor("audit-bucket", "prefix/", 180, "GOVERNANCE", "111222333444");
      const config = anchor.getConfig();
      expect(config.bucket).toBe("audit-bucket");
      expect(config.retentionDays).toBe(180);
      expect(config.retentionMode).toBe("GOVERNANCE");
      expect(config.crossAccountId).toBe("111222333444");
    });
  });

  describe("RFC3161 specific verifications", () => {
    it("messageImprint is SHA-256 of anchorHash", async () => {
      const anchor = new Rfc3161TsaAnchor("https://tsa.example.com");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const proof = receipt.proof as any;
      const expectedImprint = sha256Hex(receipt.anchorHash);
      expect(proof.messageImprint).toBe(expectedImprint);
    });

    it("verify detects messageImprint mismatch", async () => {
      const anchor = new Rfc3161TsaAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const tampered: AnchorReceipt = {
        ...receipt,
        proof: {
          ...receipt.proof,
          messageImprint: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      };
      const result = await anchor.verify(tampered);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("imprint mismatch");
    });

    it("verify passes when no timestampToken (offline mode)", async () => {
      const anchor = new Rfc3161TsaAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const proof = receipt.proof as any;
      expect(proof.timestampToken).toBeNull();

      const result = await anchor.verify(receipt);
      expect(result.valid).toBe(true);
      expect(result.reason).toContain("offline");
    });

    it("trustedFingerprints are included in proof", async () => {
      const fingerprints = ["sha256:abc123", "sha256:def456"];
      const anchor = new Rfc3161TsaAnchor("https://tsa.example.com", fingerprints);
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      const proof = receipt.proof as any;
      expect(proof.trustedFingerprints).toEqual(fingerprints);
    });

    it("config exposes TSA URL and fingerprints", () => {
      const anchor = new Rfc3161TsaAnchor("https://custom-tsa.com/tsr", ["fp1"]);
      const config = anchor.getConfig();
      expect(config.tsaUrl).toBe("https://custom-tsa.com/tsr");
      expect(config.trustedFingerprints).toEqual(["fp1"]);
    });
  });

  describe("MultiAnchor", () => {
    it("fans out to all backends", async () => {
      const s3 = new S3WormAnchor("bucket");
      const tsa = new Rfc3161TsaAnchor();
      const multi = new MultiAnchor([s3, tsa]);

      expect(multi.name()).toBe("multi(s3-worm+rfc3161)");

      const cp = makeTestCheckpoint();
      const receipt = await multi.anchor(cp, engineId, auditPayloadVersion);

      expect(receipt.anchorType).toBe("s3-worm");
      expect(receipt.anchorId).toContain("multi:");

      const proof = receipt.proof as any;
      expect(proof.type).toBe("multi");
      expect(proof.receipts).toHaveLength(2);
      expect(proof.receipts[0].anchorType).toBe("s3-worm");
      expect(proof.receipts[1].anchorType).toBe("rfc3161");
    });
  });

  describe("anchor payload binding", () => {
    it("anchorPayload checkpoint_id matches checkpoint", async () => {
      const anchor = new LogOnlyAnchor();
      const cp = makeTestCheckpoint(10);
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      expect(receipt.anchorPayload.checkpoint_id).toBe(cp.id);
      expect(receipt.anchorPayload.checkpoint_seq).toBe(cp.seq);
      expect(receipt.anchorPayload.event_hash).toBe(cp.hash);
      expect(receipt.anchorPayload.kid).toBe(cp.publicKeyId);
    });

    it("anchorPayload _v is 1", async () => {
      const anchor = new LogOnlyAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);

      expect(receipt.anchorPayload._v).toBe(1);
      expect(receipt.anchorPayload.engine_id).toBe(engineId);
      expect(receipt.anchorPayload.audit_payload_version).toBe(auditPayloadVersion);
    });
  });

  describe("anchor-required mode validation", () => {
    it("log-only receipts are not 'real' anchors", async () => {
      const anchor = new LogOnlyAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);
      expect(receipt.anchorType).toBe("log-only");

      const isReal = receipt.anchorType !== "log-only";
      expect(isReal).toBe(false);
    });

    it("s3-worm receipts are 'real' anchors", async () => {
      const anchor = new S3WormAnchor("bucket");
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);
      expect(receipt.anchorType).toBe("s3-worm");

      const isReal = receipt.anchorType !== "log-only";
      expect(isReal).toBe(true);
    });

    it("rfc3161 receipts are 'real' anchors", async () => {
      const anchor = new Rfc3161TsaAnchor();
      const cp = makeTestCheckpoint();
      const receipt = await anchor.anchor(cp, engineId, auditPayloadVersion);
      expect(receipt.anchorType).toBe("rfc3161");

      const isReal = receipt.anchorType !== "log-only";
      expect(isReal).toBe(true);
    });
  });
});
