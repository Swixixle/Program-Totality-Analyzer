import { generateKeyPairSync, sign, verify, createHash, randomUUID } from "crypto";
import { stableStringifyStrict, sha256Hex } from "./audit-canon";
import { getVersionInfo } from "./version";

export type KeyEnvironment = "ephemeral" | "dev" | "staging" | "prod";

export interface CheckpointPayload {
  _v: 1;
  checkpoint_seq: number;
  event_seq: number;
  event_hash: string;
  ts: string;
  prev_checkpoint_id: string | null;
  prev_checkpoint_hash: string | null;
  event_count: number;
  audit_payload_version: number;
  engine_id: string;
  signature_alg: "Ed25519";
  public_key_id: string;
}

export interface SignedCheckpoint {
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

export interface CheckpointKeyPair {
  publicKeyId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  environment: KeyEnvironment;
}

export interface KeyRingEntry {
  kid: string;
  publicKeyPem: string;
  environment: KeyEnvironment;
  activatedAt: string;
  retiredAt: string | null;
}

let activeKeyPair: CheckpointKeyPair | null = null;
const keyRing: Map<string, KeyRingEntry> = new Map();

export function getKeyRing(): KeyRingEntry[] {
  return Array.from(keyRing.values());
}

export function addToKeyRing(kid: string, publicKeyPem: string, environment: KeyEnvironment, activatedAt?: string, retiredAt?: string | null) {
  keyRing.set(kid, {
    kid,
    publicKeyPem,
    environment,
    activatedAt: activatedAt ?? new Date().toISOString(),
    retiredAt: retiredAt ?? null,
  });
}

export function resolvePublicKey(kid: string): string | null {
  const entry = keyRing.get(kid);
  return entry?.publicKeyPem ?? null;
}

function classifyKeyEnvironment(): KeyEnvironment {
  const envName = process.env.CHECKPOINT_KEY_ENV;
  if (envName === "prod" || envName === "staging" || envName === "dev") return envName;
  if (process.env.CHECKPOINT_SIGNING_KEY) return "prod";
  return "ephemeral";
}

export function getOrCreateCheckpointKey(): CheckpointKeyPair {
  if (activeKeyPair) return activeKeyPair;

  const envPrivate = process.env.CHECKPOINT_SIGNING_KEY;
  const envPublic = process.env.CHECKPOINT_VERIFY_KEY;
  const envKeyId = process.env.CHECKPOINT_KEY_ID;
  const environment = classifyKeyEnvironment();

  if (envPrivate && envPublic && envKeyId) {
    activeKeyPair = {
      publicKeyId: envKeyId,
      publicKeyPem: envPublic,
      privateKeyPem: envPrivate,
      environment,
    };
    addToKeyRing(envKeyId, envPublic, environment);
    return activeKeyPair;
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const publicKeyId = `ephemeral-${sha256Hex(publicKeyPem).slice(0, 16)}`;

  activeKeyPair = { publicKeyId, publicKeyPem, privateKeyPem, environment: "ephemeral" };
  addToKeyRing(publicKeyId, publicKeyPem, "ephemeral");

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: "warn",
    event: "checkpoint.key.ephemeral",
    publicKeyId,
    message: "Generated ephemeral Ed25519 key pair. Set CHECKPOINT_SIGNING_KEY, CHECKPOINT_VERIFY_KEY, CHECKPOINT_KEY_ID for persistent signing.",
  }));

  return activeKeyPair;
}

let checkpointSeqCounter = 0;

export function buildCheckpointPayload(
  seq: number,
  hash: string,
  eventCount: number,
  prevCheckpointId: string | null,
  prevCheckpointHash: string | null,
): CheckpointPayload {
  const keyPair = getOrCreateCheckpointKey();
  const version = getVersionInfo();
  checkpointSeqCounter++;
  return {
    _v: 1,
    checkpoint_seq: checkpointSeqCounter,
    event_seq: seq,
    event_hash: hash,
    ts: new Date().toISOString(),
    prev_checkpoint_id: prevCheckpointId,
    prev_checkpoint_hash: prevCheckpointHash,
    event_count: eventCount,
    audit_payload_version: version.auditPayloadVersion,
    engine_id: version.engineId,
    signature_alg: "Ed25519",
    public_key_id: keyPair.publicKeyId,
  };
}

export function signCheckpoint(payload: CheckpointPayload): SignedCheckpoint {
  const keyPair = getOrCreateCheckpointKey();
  const canonical = stableStringifyStrict(payload);
  const sig = sign(null, Buffer.from(canonical, "utf8"), keyPair.privateKeyPem);

  return {
    id: randomUUID(),
    seq: payload.event_seq,
    hash: payload.event_hash,
    ts: payload.ts,
    prevCheckpointId: payload.prev_checkpoint_id,
    prevCheckpointHash: payload.prev_checkpoint_hash,
    signatureAlg: payload.signature_alg,
    publicKeyId: payload.public_key_id,
    signature: sig.toString("base64"),
    signedPayload: canonical,
    eventCount: payload.event_count,
  };
}

export function verifyCheckpointSignature(
  signedPayload: string,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    return verify(
      null,
      Buffer.from(signedPayload, "utf8"),
      publicKeyPem,
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

export function getPublicKeyPem(): string {
  return getOrCreateCheckpointKey().publicKeyPem;
}

export const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL || "100", 10);
