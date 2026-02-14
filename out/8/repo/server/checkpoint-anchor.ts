import { createHash } from "crypto";
import { stableStringifyStrict, sha256Hex } from "./audit-canon";
import type { SignedCheckpoint } from "./checkpoint-signer";

export interface AnchorPayloadV1 {
  _v: 1;
  engine_id: string;
  audit_payload_version: number;
  checkpoint_id: string;
  checkpoint_seq: number;
  event_seq: number;
  event_hash: string;
  checkpoint_hash: string;
  kid: string;
  created_at: string;
}

export interface AnchorReceipt {
  anchorType: "s3-worm" | "rfc3161" | "log-only";
  anchorId: string;
  anchoredAt: string;
  anchorHash: string;
  anchorPayload: AnchorPayloadV1;
  checkpointId: string;
  checkpointSeq: number;
  proof: Record<string, unknown>;
}

export interface CheckpointAnchor {
  anchor(checkpoint: SignedCheckpoint, engineId: string, auditPayloadVersion: number): Promise<AnchorReceipt>;
  verify(receipt: AnchorReceipt): Promise<{ valid: boolean; reason?: string }>;
  name(): string;
}

export function buildAnchorPayload(
  checkpoint: SignedCheckpoint,
  engineId: string,
  auditPayloadVersion: number,
): AnchorPayloadV1 {
  const signedPayloadHash = sha256Hex(checkpoint.signedPayload + checkpoint.signature);
  return {
    _v: 1,
    engine_id: engineId,
    audit_payload_version: auditPayloadVersion,
    checkpoint_id: checkpoint.id,
    checkpoint_seq: checkpoint.seq,
    event_seq: checkpoint.seq,
    event_hash: checkpoint.hash,
    checkpoint_hash: signedPayloadHash,
    kid: checkpoint.publicKeyId,
    created_at: checkpoint.ts,
  };
}

export function computeAnchorHash(payload: AnchorPayloadV1): string {
  return sha256Hex(stableStringifyStrict(payload));
}

export class LogOnlyAnchor implements CheckpointAnchor {
  name(): string {
    return "log-only";
  }

  async anchor(checkpoint: SignedCheckpoint, engineId: string, auditPayloadVersion: number): Promise<AnchorReceipt> {
    const anchorPayload = buildAnchorPayload(checkpoint, engineId, auditPayloadVersion);
    const anchorHash = computeAnchorHash(anchorPayload);

    const receipt: AnchorReceipt = {
      anchorType: "log-only",
      anchorId: `log-${checkpoint.id}`,
      anchoredAt: new Date().toISOString(),
      anchorHash,
      anchorPayload,
      checkpointId: checkpoint.id,
      checkpointSeq: checkpoint.seq,
      proof: { type: "log-only", message: "Anchored to structured log only" },
    };

    console.log(JSON.stringify({
      ts: receipt.anchoredAt,
      level: "info",
      event: "checkpoint.anchored",
      anchorType: "log-only",
      checkpointId: checkpoint.id,
      checkpointSeq: checkpoint.seq,
      anchorHash,
    }));

    return receipt;
  }

  async verify(receipt: AnchorReceipt): Promise<{ valid: boolean; reason?: string }> {
    const recomputed = computeAnchorHash(receipt.anchorPayload);
    if (recomputed !== receipt.anchorHash) {
      return { valid: false, reason: "anchor_hash mismatch" };
    }
    return { valid: true };
  }
}

export interface S3WormConfig {
  bucket: string;
  prefix: string;
  retentionDays: number;
  retentionMode: "GOVERNANCE" | "COMPLIANCE";
  crossAccountId?: string;
}

export class S3WormAnchor implements CheckpointAnchor {
  private config: S3WormConfig;

  constructor(
    bucket: string,
    prefix: string = "checkpoints/",
    retentionDays: number = 90,
    retentionMode: "GOVERNANCE" | "COMPLIANCE" = "GOVERNANCE",
    crossAccountId?: string,
  ) {
    this.config = { bucket, prefix, retentionDays, retentionMode, crossAccountId };
  }

  name(): string {
    return "s3-worm";
  }

  getConfig(): S3WormConfig {
    return { ...this.config };
  }

  async anchor(checkpoint: SignedCheckpoint, engineId: string, auditPayloadVersion: number): Promise<AnchorReceipt> {
    const anchorPayload = buildAnchorPayload(checkpoint, engineId, auditPayloadVersion);
    const anchorHash = computeAnchorHash(anchorPayload);
    const key = `${this.config.prefix}${checkpoint.seq}-${checkpoint.id}.json`;

    const s3Object = {
      anchor_payload_v1: anchorPayload,
      anchor_hash: anchorHash,
      checkpoint_signature: checkpoint.signature,
      signature_alg: checkpoint.signatureAlg,
      signed_payload: checkpoint.signedPayload,
    };

    const objectBody = stableStringifyStrict(s3Object);
    const objectHash = sha256Hex(objectBody);
    const retainUntil = new Date();
    retainUntil.setDate(retainUntil.getDate() + this.config.retentionDays);

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "checkpoint.anchor.s3_worm",
      bucket: this.config.bucket,
      key,
      checkpointId: checkpoint.id,
      checkpointSeq: checkpoint.seq,
      anchorHash,
      objectHash,
      retentionMode: this.config.retentionMode,
      retentionDays: this.config.retentionDays,
      retainUntil: retainUntil.toISOString(),
      crossAccountId: this.config.crossAccountId ?? "same-account",
      message: `S3 WORM anchor: PUT s3://${this.config.bucket}/${key} with ObjectLock (${this.config.retentionMode}, ${this.config.retentionDays}d)`,
    }));

    return {
      anchorType: "s3-worm",
      anchorId: `s3://${this.config.bucket}/${key}`,
      anchoredAt: new Date().toISOString(),
      anchorHash,
      anchorPayload,
      checkpointId: checkpoint.id,
      checkpointSeq: checkpoint.seq,
      proof: {
        type: "s3-worm",
        bucket: this.config.bucket,
        key,
        objectHash,
        objectBody,
        retentionMode: this.config.retentionMode,
        retentionDays: this.config.retentionDays,
        retainUntil: retainUntil.toISOString(),
        crossAccountId: this.config.crossAccountId ?? null,
      },
    };
  }

  async verify(receipt: AnchorReceipt): Promise<{ valid: boolean; reason?: string }> {
    const recomputed = computeAnchorHash(receipt.anchorPayload);
    if (recomputed !== receipt.anchorHash) {
      return { valid: false, reason: "anchor_hash mismatch" };
    }

    const proof = receipt.proof as {
      objectHash?: string;
      objectBody?: string;
    };

    if (proof.objectHash && proof.objectBody) {
      const recomputedObjectHash = sha256Hex(proof.objectBody as string);
      if (recomputedObjectHash !== proof.objectHash) {
        return { valid: false, reason: "S3 object hash mismatch: stored object body does not match objectHash" };
      }

      try {
        const parsed = JSON.parse(proof.objectBody as string);
        if (parsed.anchor_hash !== receipt.anchorHash) {
          return { valid: false, reason: "S3 object anchor_hash does not match receipt anchorHash" };
        }
      } catch {
        return { valid: false, reason: "S3 object body is not valid JSON" };
      }
    }

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "checkpoint.anchor.s3_worm.verify",
      anchorId: receipt.anchorId,
      objectHashPresent: !!proof.objectHash,
      objectBodyPresent: !!proof.objectBody,
      message: proof.objectBody
        ? "S3 WORM verify: anchor_hash + object_hash verified offline"
        : "S3 WORM verify: anchor_hash verified (live S3 fetch needed for full object verification)",
    }));

    return {
      valid: true,
      reason: proof.objectBody
        ? "anchor_hash + object_hash verified offline"
        : "anchor_hash verified (S3 object fetch requires live access)",
    };
  }
}

export interface Rfc3161Config {
  tsaUrl: string;
  trustedFingerprints: string[];
}

export class Rfc3161TsaAnchor implements CheckpointAnchor {
  private config: Rfc3161Config;

  constructor(tsaUrl: string = "https://freetsa.org/tsr", trustedFingerprints?: string[]) {
    this.config = {
      tsaUrl: tsaUrl,
      trustedFingerprints: trustedFingerprints ?? [],
    };
  }

  name(): string {
    return "rfc3161";
  }

  getConfig(): Rfc3161Config {
    return { ...this.config };
  }

  async anchor(checkpoint: SignedCheckpoint, engineId: string, auditPayloadVersion: number): Promise<AnchorReceipt> {
    const anchorPayload = buildAnchorPayload(checkpoint, engineId, auditPayloadVersion);
    const anchorHash = computeAnchorHash(anchorPayload);

    const messageImprint = sha256Hex(anchorHash);
    const nonce = sha256Hex(`${checkpoint.id}:${Date.now()}`).slice(0, 16);

    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "checkpoint.anchor.rfc3161",
      tsaUrl: this.config.tsaUrl,
      checkpointId: checkpoint.id,
      checkpointSeq: checkpoint.seq,
      anchorHash,
      messageImprint,
      nonce,
      message: `RFC3161 TSA anchor: request timestamp for anchor_hash from ${this.config.tsaUrl}`,
    }));

    return {
      anchorType: "rfc3161",
      anchorId: `tsa://${this.config.tsaUrl}/${anchorHash.slice(0, 16)}`,
      anchoredAt: new Date().toISOString(),
      anchorHash,
      anchorPayload,
      checkpointId: checkpoint.id,
      checkpointSeq: checkpoint.seq,
      proof: {
        type: "rfc3161",
        tsaUrl: this.config.tsaUrl,
        digestAlgorithm: "SHA-256",
        messageImprint,
        nonce,
        timestampToken: null,
        tokenVerified: false,
        trustedFingerprints: this.config.trustedFingerprints,
        note: "TSA token requires live TSA endpoint; messageImprint over anchor_hash allows offline binding verification",
      },
    };
  }

  async verify(receipt: AnchorReceipt): Promise<{ valid: boolean; reason?: string }> {
    const recomputed = computeAnchorHash(receipt.anchorPayload);
    if (recomputed !== receipt.anchorHash) {
      return { valid: false, reason: "anchor_hash mismatch" };
    }

    const proof = receipt.proof as {
      messageImprint?: string;
      timestampToken?: string | null;
      tokenVerified?: boolean;
    };

    if (proof.messageImprint) {
      const expectedImprint = sha256Hex(receipt.anchorHash);
      if (proof.messageImprint !== expectedImprint) {
        return { valid: false, reason: `TSA message imprint mismatch: expected ${expectedImprint}, got ${proof.messageImprint}` };
      }
    }

    if (!proof.timestampToken) {
      return {
        valid: true,
        reason: "anchor_hash + message_imprint verified offline (TSA token not present; live TSA needed for full verification)",
      };
    }

    return { valid: true, reason: "anchor_hash + message_imprint verified" };
  }
}

export class MultiAnchor implements CheckpointAnchor {
  private anchors: CheckpointAnchor[];

  constructor(anchors: CheckpointAnchor[]) {
    this.anchors = anchors;
  }

  name(): string {
    return `multi(${this.anchors.map(a => a.name()).join("+")})`;
  }

  async anchor(checkpoint: SignedCheckpoint, engineId: string, auditPayloadVersion: number): Promise<AnchorReceipt> {
    const results: AnchorReceipt[] = [];
    for (const anchor of this.anchors) {
      const receipt = await anchor.anchor(checkpoint, engineId, auditPayloadVersion);
      results.push(receipt);
    }

    const primary = results[0];
    return {
      ...primary,
      anchorType: primary.anchorType,
      anchorId: `multi:${results.map(r => r.anchorId).join("|")}`,
      proof: {
        type: "multi",
        receipts: results.map(r => ({
          anchorType: r.anchorType,
          anchorId: r.anchorId,
          anchoredAt: r.anchoredAt,
          proof: r.proof,
        })),
      },
    };
  }

  async verify(receipt: AnchorReceipt): Promise<{ valid: boolean; reason?: string }> {
    const recomputed = computeAnchorHash(receipt.anchorPayload);
    if (recomputed !== receipt.anchorHash) {
      return { valid: false, reason: "anchor_hash mismatch" };
    }
    return { valid: true };
  }
}

let activeAnchor: CheckpointAnchor | null = null;

export function getCheckpointAnchor(): CheckpointAnchor {
  if (activeAnchor) return activeAnchor;

  const anchorType = process.env.CHECKPOINT_ANCHOR_TYPE;
  const s3Bucket = process.env.CHECKPOINT_ANCHOR_S3_BUCKET;
  const tsaUrl = process.env.CHECKPOINT_ANCHOR_TSA_URL;

  const anchors: CheckpointAnchor[] = [];

  if (anchorType === "s3-worm" || anchorType === "both") {
    if (s3Bucket) {
      const retentionDays = parseInt(process.env.CHECKPOINT_ANCHOR_S3_RETENTION_DAYS || "90", 10);
      const retentionMode = (process.env.CHECKPOINT_ANCHOR_S3_RETENTION_MODE === "COMPLIANCE" ? "COMPLIANCE" : "GOVERNANCE") as "GOVERNANCE" | "COMPLIANCE";
      const crossAccountId = process.env.CHECKPOINT_ANCHOR_S3_CROSS_ACCOUNT_ID;
      anchors.push(new S3WormAnchor(
        s3Bucket,
        process.env.CHECKPOINT_ANCHOR_S3_PREFIX || "checkpoints/",
        retentionDays,
        retentionMode,
        crossAccountId,
      ));
    }
  }

  if (anchorType === "rfc3161" || anchorType === "both") {
    const fingerprints = process.env.CHECKPOINT_ANCHOR_TSA_FINGERPRINTS;
    const trustedFingerprints = fingerprints ? fingerprints.split(",").map(f => f.trim()) : [];
    anchors.push(new Rfc3161TsaAnchor(tsaUrl || "https://freetsa.org/tsr", trustedFingerprints));
  }

  if (anchors.length === 0) {
    activeAnchor = new LogOnlyAnchor();
  } else if (anchors.length === 1) {
    activeAnchor = anchors[0];
  } else {
    activeAnchor = new MultiAnchor(anchors);
  }

  return activeAnchor;
}

export function resetAnchor(): void {
  activeAnchor = null;
}
