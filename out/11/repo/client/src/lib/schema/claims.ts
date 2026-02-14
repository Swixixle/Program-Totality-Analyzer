export type ClaimClassification = "DEFENSIBLE" | "RESTRICTED" | "AMBIGUOUS";

export interface Claim {
  id: string;
  classification: ClaimClassification;
  text: string;
  confidence: number;
  refusal_reason: string | null;
  anchor_ids: string[];
}

export interface ClaimsResponse {
  corpusId: string;
  claims: Claim[];
}

export function clampConfidence(value: number): number {
  if (value >= 1.0) {
    console.warn("[Claim] Confidence clamped from 1.0 to 0.95");
    return 0.95;
  }
  return Math.min(value, 0.99);
}

export function confidenceToBand(confidence: number): string {
  const clamped = clampConfidence(confidence);
  if (clamped >= 0.90) return "90–99%";
  if (clamped >= 0.80) return "80–90%";
  if (clamped >= 0.70) return "70–80%";
  if (clamped >= 0.60) return "60–70%";
  return "<60%";
}

export const MOCK_CLAIMS: Claim[] = [
  {
    id: "claim-def-001",
    classification: "DEFENSIBLE",
    text: "The contract was signed on March 15, 2024 by both parties.",
    confidence: 0.87,
    refusal_reason: null,
    anchor_ids: ["anchor-001", "anchor-002"]
  },
  {
    id: "claim-def-002",
    classification: "DEFENSIBLE",
    text: "Payment terms specify net-30 from invoice date.",
    confidence: 0.82,
    refusal_reason: null,
    anchor_ids: ["anchor-003"]
  },
  {
    id: "claim-res-001",
    classification: "RESTRICTED",
    text: "The defendant acted with malicious intent.",
    confidence: 0.45,
    refusal_reason: "The corpus does not support this claim. No direct evidence of intent is present in the source documents.",
    anchor_ids: []
  },
  {
    id: "claim-res-002",
    classification: "RESTRICTED",
    text: "All stakeholders were notified prior to the decision.",
    confidence: 0.38,
    refusal_reason: "Notification records are incomplete. Only partial evidence exists for 2 of 7 stakeholders.",
    anchor_ids: []
  },
  {
    id: "claim-amb-001",
    classification: "AMBIGUOUS",
    text: "The meeting occurred sometime in Q2 2024.",
    confidence: 0.62,
    refusal_reason: null,
    anchor_ids: []
  }
];
