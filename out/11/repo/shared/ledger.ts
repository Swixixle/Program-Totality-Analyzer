export type LedgerEventType =
  | "CORPUS_CREATED"
  | "SOURCE_UPLOADED"
  | "BUILD_RUN"
  | "CLAIM_CREATED"
  | "CLAIM_DELETED"
  | "SNAPSHOT_CREATED"
  | "PACKET_CREATED";

export type LedgerEntityType = "CORPUS" | "SOURCE" | "BUILD" | "CLAIM" | "SNAPSHOT" | "PACKET";

export interface LedgerEvent {
  event_id: string;
  occurred_at: string;
  corpus_id: string;
  event_type: LedgerEventType;
  entity: {
    entity_type: LedgerEntityType;
    entity_id: string;
  };
  payload: Record<string, any>;
  hash_alg: "SHA-256";
  hash_hex: string;
}

export interface CorpusCreatedPayload {
  purpose: string;
}

export interface SourceUploadedPayload {
  source_id: string;
  role: "PRIMARY" | "SECONDARY";
  filename: string;
  sha256_hex: string;
}

export interface BuildRunPayload {
  mode: "anchors_only" | "claims_from_anchors";
  status: "COMPLETED" | "FAILED";
  anchors_created: number;
  claims_created: number;
  constraints_created: number;
}

export interface ClaimCreatedPayload {
  claim_id: string;
  classification: "DEFENSIBLE" | "RESTRICTED" | "AMBIGUOUS";
  anchor_count: number;
}

export interface ClaimDeletedPayload {
  claim_id: string;
}

export interface SnapshotCreatedPayload {
  snapshot_id: string;
  hash_hex: string;
}

export interface PacketCreatedPayload {
  packet_id: string;
  claim_id: string;
  snapshot_id: string;
  hash_hex: string;
}
