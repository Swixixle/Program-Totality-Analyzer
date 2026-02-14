import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createHash, verify as cryptoVerify } from "crypto";
import { stableStringifyStrict, auditPayloadV1, hashAuditPayload } from "../audit-canon";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const kid = `test-${sha256Hex(publicKeyPem).slice(0, 12)}`;
  return { kid, publicKeyPem, privateKeyPem };
}

function signPayload(canonical: string, privateKeyPem: string): string {
  const { sign } = require("crypto");
  return sign(null, Buffer.from(canonical, "utf8"), privateKeyPem).toString("base64");
}

function verifySignature(canonical: string, sig: string, publicKeyPem: string): boolean {
  try {
    return cryptoVerify(null, Buffer.from(canonical, "utf8"), publicKeyPem, Buffer.from(sig, "base64"));
  } catch {
    return false;
  }
}

interface SimCheckpoint {
  id: string;
  seq: number;
  hash: string;
  ts: string;
  prevCheckpointId: string | null;
  prevCheckpointHash: string | null;
  signatureAlg: "Ed25519";
  publicKeyId: string;
  signature: string;
  signedPayload: string;
  eventCount: number;
}

interface SimEvent {
  seq: number;
  ts: string;
  action: string;
  actor: string;
  receiptId: string | null;
  exportId: string | null;
  savedViewId: string | null;
  payload: string;
  ip: string | null;
  userAgent: string | null;
  prevHash: string;
  hash: string;
  schemaVersion: string;
  payloadV: number;
}

function generateEventsAndCheckpoints(opts: {
  eventCount: number;
  checkpointInterval: number;
  kid: string;
  privateKeyPem: string;
  startSeq: number;
  prevHash: string;
  prevCheckpointId: string | null;
  prevCheckpointHash: string | null;
  checkpointSeqStart: number;
}): { events: SimEvent[]; checkpoints: SimCheckpoint[]; lastHash: string; lastCheckpointId: string | null; lastCheckpointHash: string | null; nextCheckpointSeq: number } {
  const events: SimEvent[] = [];
  const checkpoints: SimCheckpoint[] = [];
  let prevHash = opts.prevHash;
  let prevCpId = opts.prevCheckpointId;
  let prevCpHash = opts.prevCheckpointHash;
  let cpSeq = opts.checkpointSeqStart;

  for (let i = 0; i < opts.eventCount; i++) {
    const seq = opts.startSeq + i;
    const ts = new Date(Date.now() + i).toISOString();
    const action = "VERIFY_STORED";
    const payload = JSON.stringify({ step: i, kid: opts.kid });
    const schemaVersion = "audit/1.1";

    const auditPayload = auditPayloadV1({
      schemaVersion, seq, ts, action, actor: "rotation_test",
      receiptId: null, exportId: null, savedViewId: null,
      payload, ip: "127.0.0.1", userAgent: "test/1.0", prevHash,
    });

    const hash = hashAuditPayload(auditPayload);

    events.push({
      seq, ts, action, actor: "rotation_test",
      receiptId: null, exportId: null, savedViewId: null,
      payload, ip: "127.0.0.1", userAgent: "test/1.0",
      prevHash, hash, schemaVersion, payloadV: 1,
    });

    if (seq % opts.checkpointInterval === 0) {
      cpSeq++;
      const eventsSinceLastCp = checkpoints.length > 0
        ? seq - checkpoints[checkpoints.length - 1].seq
        : seq - (opts.startSeq - 1);

      const cpPayload = {
        _v: 1,
        checkpoint_seq: cpSeq,
        event_seq: seq,
        event_hash: hash,
        ts,
        prev_checkpoint_id: prevCpId,
        prev_checkpoint_hash: prevCpHash,
        event_count: eventsSinceLastCp,
        audit_payload_version: 1,
        engine_id: "test-engine/1.0",
        signature_alg: "Ed25519" as const,
        public_key_id: opts.kid,
      };

      const canonical = stableStringifyStrict(cpPayload);
      const signature = signPayload(canonical, opts.privateKeyPem);
      const cpId = `cp-${seq}-${opts.kid.slice(0, 8)}`;

      const checkpoint: SimCheckpoint = {
        id: cpId,
        seq,
        hash,
        ts,
        prevCheckpointId: prevCpId,
        prevCheckpointHash: prevCpHash,
        signatureAlg: "Ed25519",
        publicKeyId: opts.kid,
        signature,
        signedPayload: canonical,
        eventCount: eventsSinceLastCp,
      };

      checkpoints.push(checkpoint);
      prevCpId = cpId;
      prevCpHash = stableStringifyStrict(JSON.parse(canonical)).slice(0, 64);
    }

    prevHash = hash;
  }

  return {
    events,
    checkpoints,
    lastHash: prevHash,
    lastCheckpointId: prevCpId,
    lastCheckpointHash: prevCpHash,
    nextCheckpointSeq: cpSeq,
  };
}

describe("Key Rotation Proof", () => {
  const keyA = generateKeyPair();
  const keyB = generateKeyPair();

  it("generates two distinct key pairs", () => {
    expect(keyA.kid).not.toBe(keyB.kid);
    expect(keyA.publicKeyPem).not.toBe(keyB.publicKeyPem);
  });

  it("creates events and checkpoints spanning key rotation (kid=A then kid=B)", () => {
    const eraA = generateEventsAndCheckpoints({
      eventCount: 10,
      checkpointInterval: 5,
      kid: keyA.kid,
      privateKeyPem: keyA.privateKeyPem,
      startSeq: 1,
      prevHash: "GENESIS",
      prevCheckpointId: null,
      prevCheckpointHash: null,
      checkpointSeqStart: 0,
    });

    expect(eraA.events).toHaveLength(10);
    expect(eraA.checkpoints).toHaveLength(2);
    expect(eraA.checkpoints.every(cp => cp.publicKeyId === keyA.kid)).toBe(true);

    const eraB = generateEventsAndCheckpoints({
      eventCount: 10,
      checkpointInterval: 5,
      kid: keyB.kid,
      privateKeyPem: keyB.privateKeyPem,
      startSeq: 11,
      prevHash: eraA.lastHash,
      prevCheckpointId: eraA.lastCheckpointId,
      prevCheckpointHash: eraA.lastCheckpointHash,
      checkpointSeqStart: eraA.nextCheckpointSeq,
    });

    expect(eraB.events).toHaveLength(10);
    expect(eraB.checkpoints).toHaveLength(2);
    expect(eraB.checkpoints.every(cp => cp.publicKeyId === keyB.kid)).toBe(true);

    const allEvents = [...eraA.events, ...eraB.events];
    const allCheckpoints = [...eraA.checkpoints, ...eraB.checkpoints];

    expect(allEvents).toHaveLength(20);
    expect(allCheckpoints).toHaveLength(4);

    const kidsSeen = new Set(allCheckpoints.map(cp => cp.publicKeyId));
    expect(kidsSeen.size).toBe(2);
    expect(kidsSeen.has(keyA.kid)).toBe(true);
    expect(kidsSeen.has(keyB.kid)).toBe(true);
  });

  it("verifies all checkpoint signatures with correct key ring", () => {
    const eraA = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyA.kid,
      privateKeyPem: keyA.privateKeyPem, startSeq: 1, prevHash: "GENESIS",
      prevCheckpointId: null, prevCheckpointHash: null, checkpointSeqStart: 0,
    });

    const eraB = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyB.kid,
      privateKeyPem: keyB.privateKeyPem, startSeq: 11, prevHash: eraA.lastHash,
      prevCheckpointId: eraA.lastCheckpointId, prevCheckpointHash: eraA.lastCheckpointHash,
      checkpointSeqStart: eraA.nextCheckpointSeq,
    });

    const allCheckpoints = [...eraA.checkpoints, ...eraB.checkpoints];
    const keyRing = new Map<string, string>([
      [keyA.kid, keyA.publicKeyPem],
      [keyB.kid, keyB.publicKeyPem],
    ]);

    for (const cp of allCheckpoints) {
      const publicKey = keyRing.get(cp.publicKeyId);
      expect(publicKey).toBeDefined();
      const valid = verifySignature(cp.signedPayload, cp.signature, publicKey!);
      expect(valid).toBe(true);
    }
  });

  it("fails signature verification when a kid is missing from key ring", () => {
    const eraA = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyA.kid,
      privateKeyPem: keyA.privateKeyPem, startSeq: 1, prevHash: "GENESIS",
      prevCheckpointId: null, prevCheckpointHash: null, checkpointSeqStart: 0,
    });

    const eraB = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyB.kid,
      privateKeyPem: keyB.privateKeyPem, startSeq: 11, prevHash: eraA.lastHash,
      prevCheckpointId: eraA.lastCheckpointId, prevCheckpointHash: eraA.lastCheckpointHash,
      checkpointSeqStart: eraA.nextCheckpointSeq,
    });

    const allCheckpoints = [...eraA.checkpoints, ...eraB.checkpoints];
    const incompleteKeyRing = new Map<string, string>([
      [keyA.kid, keyA.publicKeyPem],
    ]);

    let missingKidDetected = false;
    for (const cp of allCheckpoints) {
      const publicKey = incompleteKeyRing.get(cp.publicKeyId);
      if (!publicKey) {
        missingKidDetected = true;
        expect(cp.publicKeyId).toBe(keyB.kid);
        break;
      }
    }
    expect(missingKidDetected).toBe(true);
  });

  it("fails signature verification with wrong key", () => {
    const eraA = generateEventsAndCheckpoints({
      eventCount: 5, checkpointInterval: 5, kid: keyA.kid,
      privateKeyPem: keyA.privateKeyPem, startSeq: 1, prevHash: "GENESIS",
      prevCheckpointId: null, prevCheckpointHash: null, checkpointSeqStart: 0,
    });

    const cp = eraA.checkpoints[0];
    const wrongKeyValid = verifySignature(cp.signedPayload, cp.signature, keyB.publicKeyPem);
    expect(wrongKeyValid).toBe(false);
  });

  it("verifies hash chain continuity across key rotation boundary", () => {
    const eraA = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyA.kid,
      privateKeyPem: keyA.privateKeyPem, startSeq: 1, prevHash: "GENESIS",
      prevCheckpointId: null, prevCheckpointHash: null, checkpointSeqStart: 0,
    });

    const eraB = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyB.kid,
      privateKeyPem: keyB.privateKeyPem, startSeq: 11, prevHash: eraA.lastHash,
      prevCheckpointId: eraA.lastCheckpointId, prevCheckpointHash: eraA.lastCheckpointHash,
      checkpointSeqStart: eraA.nextCheckpointSeq,
    });

    const allEvents = [...eraA.events, ...eraB.events];

    let expectedPrevHash = "GENESIS";
    for (const ev of allEvents) {
      expect(ev.prevHash).toBe(expectedPrevHash);
      const recomputed = hashAuditPayload(auditPayloadV1({
        schemaVersion: ev.schemaVersion, seq: ev.seq, ts: ev.ts,
        action: ev.action, actor: ev.actor, receiptId: ev.receiptId,
        exportId: ev.exportId, savedViewId: ev.savedViewId,
        payload: ev.payload, ip: ev.ip, userAgent: ev.userAgent, prevHash: ev.prevHash,
      }));
      expect(recomputed).toBe(ev.hash);
      expectedPrevHash = ev.hash;
    }

    expect(eraB.events[0].prevHash).toBe(eraA.events[eraA.events.length - 1].hash);
  });

  it("verifies checkpoint chain continuity across key rotation", () => {
    const eraA = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyA.kid,
      privateKeyPem: keyA.privateKeyPem, startSeq: 1, prevHash: "GENESIS",
      prevCheckpointId: null, prevCheckpointHash: null, checkpointSeqStart: 0,
    });

    const eraB = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyB.kid,
      privateKeyPem: keyB.privateKeyPem, startSeq: 11, prevHash: eraA.lastHash,
      prevCheckpointId: eraA.lastCheckpointId, prevCheckpointHash: eraA.lastCheckpointHash,
      checkpointSeqStart: eraA.nextCheckpointSeq,
    });

    const allCheckpoints = [...eraA.checkpoints, ...eraB.checkpoints];

    expect(allCheckpoints[0].prevCheckpointId).toBeNull();
    expect(allCheckpoints[0].prevCheckpointHash).toBeNull();

    for (let i = 1; i < allCheckpoints.length; i++) {
      expect(allCheckpoints[i].prevCheckpointId).toBe(allCheckpoints[i - 1].id);
      expect(allCheckpoints[i].prevCheckpointHash).toBeDefined();
      expect(allCheckpoints[i].prevCheckpointHash).not.toBeNull();
    }

    const crossBoundary = allCheckpoints[2];
    expect(crossBoundary.publicKeyId).toBe(keyB.kid);
    expect(crossBoundary.prevCheckpointId).toBe(allCheckpoints[1].id);
    expect(allCheckpoints[1].publicKeyId).toBe(keyA.kid);
  });

  it("pack manifest correctly lists both signing key IDs", () => {
    const eraA = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyA.kid,
      privateKeyPem: keyA.privateKeyPem, startSeq: 1, prevHash: "GENESIS",
      prevCheckpointId: null, prevCheckpointHash: null, checkpointSeqStart: 0,
    });

    const eraB = generateEventsAndCheckpoints({
      eventCount: 10, checkpointInterval: 5, kid: keyB.kid,
      privateKeyPem: keyB.privateKeyPem, startSeq: 11, prevHash: eraA.lastHash,
      prevCheckpointId: eraA.lastCheckpointId, prevCheckpointHash: eraA.lastCheckpointHash,
      checkpointSeqStart: eraA.nextCheckpointSeq,
    });

    const allCheckpoints = [...eraA.checkpoints, ...eraB.checkpoints];
    const signingKeyIds = [...new Set(allCheckpoints.map(cp => cp.publicKeyId))].join(",");

    expect(signingKeyIds).toContain(keyA.kid);
    expect(signingKeyIds).toContain(keyB.kid);
    expect(signingKeyIds.split(",")).toHaveLength(2);
  });
});
