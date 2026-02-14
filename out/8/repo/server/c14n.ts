import { createHash } from "crypto";
import type { Message } from "@shared/schema";

export interface CanonicalizationResult {
  canonical_transcript: string;
  c14n_version: "c14n-v1";
  fields_hashed: string[];
  message_count_hashed: number;
  hash_input_bytes: number;
}

export function canonicalize(messages: Message[]): CanonicalizationResult {
  const normalized = messages.map((msg) => ({
    role: msg.role.toLowerCase(),
    content: msg.content,
  }));
  
  const canonical = {
    messages: normalized,
  };
  
  const canonical_transcript = JSON.stringify(canonical);
  
  return {
    canonical_transcript,
    c14n_version: "c14n-v1",
    fields_hashed: ["role", "content"],
    message_count_hashed: messages.length,
    hash_input_bytes: Buffer.byteLength(canonical_transcript, "utf8"),
  };
}

export function computeHash(canonicalTranscript: string): string {
  return createHash("sha256").update(canonicalTranscript).digest("hex");
}
