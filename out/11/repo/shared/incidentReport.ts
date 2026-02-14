import { z } from "zod";

export const ReportStatus = z.enum([
  "ADMISSIBLE",
  "REJECTED", 
  "SCRAPBOOKED",
  "PENDING_TIME",
  "QUARANTINED",
  "DISPUTED"
]);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const Environment = z.enum(["demo", "staging", "prod"]);
export type Environment = z.infer<typeof Environment>;

export const AuthoringMode = z.enum(["human_assisted", "system_generated"]);
export type AuthoringMode = z.infer<typeof AuthoringMode>;

export const ConfidenceLevel = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const VerificationStatus = z.enum(["verified", "partial", "disputed"]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const AuthorityTier = z.enum(["advisory_only", "procedurally_permitted"]);
export type AuthorityTier = z.infer<typeof AuthorityTier>;

export const RefusalDisposition = z.enum(["rejected", "rewritten", "quarantined"]);
export type RefusalDisposition = z.infer<typeof RefusalDisposition>;

export const ReasonCodeSchema = z.object({
  code: z.string(),
  family: z.enum(["R", "P", "S", "A"]),
  description: z.string()
});
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

export const REASON_CODES = {
  R001: { code: "R001", family: "R" as const, description: "Structural format violation" },
  R002: { code: "R002", family: "R" as const, description: "Missing required field" },
  R003: { code: "R003", family: "R" as const, description: "Evaluative language detected" },
  R004: { code: "R004", family: "R" as const, description: "Outcome knowledge contamination" },
  P001: { code: "P001", family: "P" as const, description: "Procedural sequence error" },
  P002: { code: "P002", family: "P" as const, description: "Authorization scope exceeded" },
  P003: { code: "P003", family: "P" as const, description: "Decision target undefined" },
  S001: { code: "S001", family: "S" as const, description: "PHI exposure risk" },
  S002: { code: "S002", family: "S" as const, description: "Prohibited language category" },
  S003: { code: "S003", family: "S" as const, description: "Scope boundary violation" },
  A001: { code: "A001", family: "A" as const, description: "Admissibility conflict" }
} as const;

export const PROHIBITED_TERMS = [
  "should have known",
  "obvious",
  "missed",
  "failed",
  "negligent",
  "negligence",
  "inappropriate",
  "error",
  "responsible party",
  "appropriate care",
  "clearly",
  "preventable",
  "standard of care",
  "deviation"
];

export const SCOPE_LIMITS_VARIANTS = {
  SCOPE_V1: `This review reconstructs decision-time conditions only. It does not assess clinical correctness, intent, standard of care, negligence, or preventability. Outcome-derived information is excluded from judgment sections. This document is advisory and does not issue verdicts or findings of fault.`,
  SCOPE_V2: `This record examines information available at the moment of decision. It explicitly excludes retrospective judgment, outcome knowledge, and comparative performance assessment. No conclusions regarding negligence, intent, or standard-of-care compliance are rendered.`,
  SCOPE_V3: `The scope of this review is limited to reconstructing what was known and knowable at decision time. Post-decision outcomes, hindsight interpretations, and evaluative language are excluded. This is an advisory document that constrains claims rather than adjudicating them.`
} as const;

export const DISALLOWED_CLAIMS = [
  "preventability",
  "negligence",
  "standard-of-care deviation",
  "intent/motivation",
  "comparative performance",
  "clinical correctness",
  "appropriateness of care",
  "missed diagnosis",
  "failure to act"
];

export const EvidenceItemSchema = z.object({
  item_id: z.string(),
  description: z.string(),
  source_type: z.string(),
  time_anchor: z.string(),
  confidence: ConfidenceLevel
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const TimelineEventSchema = z.object({
  timestamp: z.string(),
  event_label: z.string(),
  what_happened: z.string(),
  source_refs: z.array(z.string()),
  verification_status: VerificationStatus
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const RefusalLogEntrySchema = z.object({
  reason_code: z.string(),
  attempted_content: z.string(),
  allowed_rewrite: z.string().nullable(),
  disposition: RefusalDisposition
});
export type RefusalLogEntry = z.infer<typeof RefusalLogEntrySchema>;

export const ActionItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  owner_role: z.string(),
  due_date: z.string().nullable(),
  verification_method: z.string().nullable()
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

export const GovernanceConstraintSchema = z.object({
  constraint_id: z.string(),
  statement: z.string(),
  evidence_refs: z.array(z.string())
});
export type GovernanceConstraint = z.infer<typeof GovernanceConstraintSchema>;

export const ImprovementOpportunitySchema = z.object({
  id: z.string(),
  description: z.string(),
  evidence_basis: z.array(z.string())
});
export type ImprovementOpportunity = z.infer<typeof ImprovementOpportunitySchema>;

export const IncidentReportSchema = z.object({
  report_version: z.literal("report_v1"),
  case_id: z.string(),
  organization: z.string().optional(),
  generated_at: z.string(),
  environment: Environment,
  status: ReportStatus,
  authoring_mode: AuthoringMode,
  data_sources: z.array(z.string()),
  scope_limits_block_id: z.enum(["SCOPE_V1", "SCOPE_V2", "SCOPE_V3"]),
  
  decision_under_review: z.object({
    decision_point: z.string(),
    window_start: z.string(),
    window_end: z.string(),
    decision_maker_role: z.string(),
    setting: z.string().optional()
  }),
  
  evidence_snapshot: z.object({
    admitted: z.array(EvidenceItemSchema),
    missing_or_pending: z.array(EvidenceItemSchema),
    excluded_outcome_info: z.array(EvidenceItemSchema)
  }),
  
  constraints: z.object({
    time_pressure: z.boolean(),
    competing_demands: z.boolean(),
    resource_limits: z.boolean(),
    guideline_ambiguity: z.boolean(),
    handoffs_fragmentation: z.boolean(),
    irreversibility: z.boolean(),
    signal_quality_limits: z.boolean(),
    constraint_evidence_refs: z.array(z.string())
  }),
  
  timeline: z.array(TimelineEventSchema),
  
  claim_boundaries: z.object({
    permitted_statements: z.array(z.string()),
    disallowed_claims: z.array(z.string())
  }),
  
  governance_output: z.object({
    authority_tier: AuthorityTier,
    constraints: z.array(GovernanceConstraintSchema)
  }),
  
  system_learning: z.object({
    notes: z.array(z.string()),
    improvement_opportunities: z.array(ImprovementOpportunitySchema),
    candidate_mitigations: z.array(z.string())
  }),
  
  action_items: z.array(ActionItemSchema),
  
  refusal_log: z.array(RefusalLogEntrySchema),
  
  finalization: z.object({
    immutable_state: z.enum(["draft", "finalized"]),
    artifact_hash: z.string().nullable(),
    previous_hash: z.string().nullable(),
    signature: z.string().nullable()
  })
});

export type IncidentReport = z.infer<typeof IncidentReportSchema>;

export const GenerateReportInputSchema = z.object({
  case_id: z.string().optional(),
  organization: z.string().optional(),
  environment: Environment.default("demo"),
  scope_variant: z.enum(["SCOPE_V1", "SCOPE_V2", "SCOPE_V3"]).default("SCOPE_V1"),
  
  decision_point: z.string(),
  window_start: z.string(),
  window_end: z.string(),
  decision_maker_role: z.string(),
  setting: z.string().optional(),
  
  admitted_evidence: z.array(z.object({
    description: z.string(),
    source_type: z.string(),
    time_anchor: z.string(),
    confidence: ConfidenceLevel.default("medium")
  })).default([]),
  
  missing_pending: z.array(z.object({
    description: z.string(),
    source_type: z.string(),
    time_anchor: z.string()
  })).default([]),
  
  excluded_outcome_info: z.array(z.object({
    description: z.string(),
    source_type: z.string(),
    time_anchor: z.string()
  })).default([]),
  
  constraints: z.object({
    time_pressure: z.boolean().default(false),
    competing_demands: z.boolean().default(false),
    resource_limits: z.boolean().default(false),
    guideline_ambiguity: z.boolean().default(false),
    handoffs_fragmentation: z.boolean().default(false),
    irreversibility: z.boolean().default(false),
    signal_quality_limits: z.boolean().default(false)
  }).default({}),
  
  timeline_events: z.array(z.object({
    timestamp: z.string(),
    event_label: z.string(),
    what_happened: z.string(),
    source_refs: z.array(z.string()).default([]),
    verification_status: VerificationStatus.default("partial")
  })).default([]),
  
  narrative_input: z.string().optional(),
  
  improvement_notes: z.array(z.string()).default([]),
  
  action_items: z.array(z.object({
    description: z.string(),
    owner_role: z.string(),
    due_date: z.string().optional(),
    verification_method: z.string().optional()
  })).default([])
});

export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

export interface RefusalResult {
  status: "refused" | "rewritten" | "quarantined";
  reason_code: string;
  what_happened: string;
  why_it_matters: string;
  how_to_proceed: string;
  original_content?: string;
  rewritten_content?: string;
}

export interface GenerateReportResult {
  success: boolean;
  report?: IncidentReport;
  markdown?: string;
  refusals: RefusalResult[];
  errors: string[];
}
