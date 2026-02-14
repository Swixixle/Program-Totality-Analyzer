/**
 * Receipt Chain Verification
 * 
 * Chain hash is computed from the canonicalized signed capsule core,
 * ensuring the chain is anchored to the immutable transcript.
 * 
 * Chain statuses:
 * - GENESIS: First receipt in chain (no previous hash)
 * - LINKED: Previous receipt exists and hash matches
 * - BROKEN: Previous receipt exists but hash doesn't match, or previous doesn't exist
 * - NOT_CHECKED: Chain verification not performed (internal use only)
 * 
 * Chain field naming convention (P2 clarification):
 * - expected_previous_hash: The value present in the submitted receipt's previous_receipt_hash_sha256 field
 *   (what the submitter CLAIMS the previous receipt hash should be)
 * - observed_previous_hash: The actual receipt_hash_sha256 computed from the stored previous receipt
 *   (what the verifier COMPUTED from the prior receipt)
 * - link_match: true if expected_previous_hash === observed_previous_hash
 */

import { createHash } from "crypto";

export type ChainStatus = "GENESIS" | "LINKED" | "BROKEN" | "NOT_CHECKED";

export interface ChainVerificationResult {
  checked: boolean;
  status: ChainStatus;
  reason: string;
  previous_receipt_id?: string;
  expected_previous_hash?: string;
  observed_previous_hash?: string;
  link_match?: boolean;
}

/**
 * Capsule core fields used for receipt hash computation.
 * This is the immutable core that the signature attests to.
 */
export interface CapsuleCore {
  schema: string;
  receipt_id: string;
  platform: string;
  captured_at: string;
  transcript_hash_sha256: string;
  canonicalization: string;
  previous_receipt_hash_sha256?: string;
  public_key_id?: string;
}

/**
 * Compute the receipt hash from the canonicalized capsule core.
 * This anchors the chain to the immutable signed content.
 * 
 * receipt_hash = SHA256(c14n(capsule_core))
 * 
 * Canonicalization: JSON.stringify with sorted keys
 */
export function computeReceiptHash(capsuleCore: CapsuleCore): string {
  // Deterministic canonicalization: sort keys alphabetically
  const sortedKeys = Object.keys(capsuleCore).sort();
  const canonical: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    const value = capsuleCore[key as keyof CapsuleCore];
    if (value !== undefined) {
      canonical[key] = value;
    }
  }
  const canonicalJson = JSON.stringify(canonical);
  return createHash("sha256").update(canonicalJson).digest("hex");
}

/**
 * Build capsule core from receipt capsule for hash computation
 */
export function buildCapsuleCore(capsule: {
  schema: string;
  receipt_id: string;
  platform: string;
  captured_at: string;
  transcript_hash_sha256: string;
  transcript: { canonicalization: string };
  previous_receipt_hash_sha256?: string;
  signature?: { public_key_id?: string };
}): CapsuleCore {
  return {
    schema: capsule.schema,
    receipt_id: capsule.receipt_id,
    platform: capsule.platform,
    captured_at: capsule.captured_at,
    transcript_hash_sha256: capsule.transcript_hash_sha256,
    canonicalization: capsule.transcript.canonicalization,
    previous_receipt_hash_sha256: capsule.previous_receipt_hash_sha256,
    public_key_id: capsule.signature?.public_key_id,
  };
}

/**
 * Verify chain link
 * @param claimedPreviousHash - The previous_receipt_hash_sha256 claimed in the current receipt
 * @param storedPreviousReceiptHash - The receipt_hash of the found previous receipt (or undefined if not found)
 * @param previousReceiptId - The receipt_id of the found previous receipt (or undefined)
 * @returns Chain verification result with link_match
 */
export function verifyChainLink(
  claimedPreviousHash: string | undefined,
  storedPreviousReceiptHash: string | undefined,
  previousReceiptId: string | undefined
): ChainVerificationResult {
  // No previous hash means this is a genesis receipt
  if (!claimedPreviousHash) {
    return {
      checked: true,
      status: "GENESIS",
      reason: "No previous_receipt_hash_sha256 - this is a genesis receipt",
    };
  }

  // Previous hash provided but receipt not found
  if (!storedPreviousReceiptHash) {
    return {
      checked: true,
      status: "BROKEN",
      reason: "Previous receipt not found in storage",
      expected_previous_hash: claimedPreviousHash,
      link_match: false,
    };
  }

  // Compare hashes
  const linkMatch = storedPreviousReceiptHash === claimedPreviousHash;
  
  if (linkMatch) {
    return {
      checked: true,
      status: "LINKED",
      reason: "Chain verified - previous receipt hash matches",
      previous_receipt_id: previousReceiptId,
      expected_previous_hash: claimedPreviousHash,
      observed_previous_hash: storedPreviousReceiptHash,
      link_match: true,
    };
  } else {
    return {
      checked: true,
      status: "BROKEN",
      reason: "Chain broken - previous receipt hash mismatch",
      previous_receipt_id: previousReceiptId,
      expected_previous_hash: claimedPreviousHash,
      observed_previous_hash: storedPreviousReceiptHash,
      link_match: false,
    };
  }
}
