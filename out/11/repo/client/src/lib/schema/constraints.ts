export type ConstraintType = "CONFLICT" | "MISSING_EVIDENCE" | "TIME_MISMATCH";

export interface ConstraintItem {
  id: string;
  type: ConstraintType;
  summary: string;
  claim_id?: string | null;
  anchor_ids: string[];
  time_context?: {
    earlier_date?: string | null;
    later_date?: string | null;
    note: string;
  } | null;
  missing?: {
    requested_assertion: string;
    reason: string;
  } | null;
  conflict?: {
    left: { anchor_id: string; source_document: string; page_ref: string };
    right: { anchor_id: string; source_document: string; page_ref: string };
  } | null;
}

export interface ConstraintsResponse {
  corpus_id: string;
  constraints: ConstraintItem[];
}

export const MOCK_CONSTRAINTS: ConstraintItem[] = [
  {
    id: "constraint-conflict-001",
    type: "CONFLICT",
    summary: "Payment terms stated as net-30 in Section 4.2 but net-45 in Amendment A.",
    claim_id: "claim-def-002",
    anchor_ids: ["anchor-003", "anchor-004"],
    time_context: null,
    missing: null,
    conflict: {
      left: { anchor_id: "anchor-003", source_document: "Master Services Agreement v2.1.pdf", page_ref: "p. 5" },
      right: { anchor_id: "anchor-004", source_document: "Amendment A.pdf", page_ref: "p. 1" }
    }
  },
  {
    id: "constraint-missing-001",
    type: "MISSING_EVIDENCE",
    summary: "No anchored comparative ranking of jurisdictions exists in corpus.",
    claim_id: null,
    anchor_ids: [],
    time_context: null,
    missing: {
      requested_assertion: "Ranking jurisdictions by enforcement strictness",
      reason: "No anchored comparative ranking exists in primary source"
    },
    conflict: null
  },
  {
    id: "constraint-time-001",
    type: "TIME_MISMATCH",
    summary: "Primary source predates statutory update referenced in secondary source.",
    claim_id: "claim-amb-001",
    anchor_ids: ["anchor-001"],
    time_context: {
      earlier_date: "2024-03-15",
      later_date: "2024-07-01",
      note: "Primary source predates statutory update referenced in secondary source"
    },
    missing: null,
    conflict: null
  }
];
