import { createHash } from "crypto";
import {
  IncidentReport,
  IncidentReportSchema,
  GenerateReportInput,
  GenerateReportResult,
  RefusalResult,
  ReportStatus,
  EvidenceItem,
  TimelineEvent,
  RefusalLogEntry,
  ActionItem,
  GovernanceConstraint,
  ImprovementOpportunity,
  PROHIBITED_TERMS,
  SCOPE_LIMITS_VARIANTS,
  DISALLOWED_CLAIMS,
  REASON_CODES,
} from "../shared/incidentReport";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deepSortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys);
  }
  
  const sortedKeys = Object.keys(obj as object).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
  }
  return result;
}

function canonicalJson(obj: unknown): string {
  const sorted = deepSortKeys(obj);
  return JSON.stringify(sorted);
}

function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function detectProhibitedTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return PROHIBITED_TERMS.filter(term => lower.includes(term.toLowerCase()));
}

function scanForEvaluativeLanguage(text: string): RefusalResult | null {
  const prohibited = detectProhibitedTerms(text);
  if (prohibited.length > 0) {
    return {
      status: "refused",
      reason_code: REASON_CODES.R003.code,
      what_happened: `Evaluative language detected: "${prohibited.join('", "')}"`,
      why_it_matters: "Evaluative terms introduce hindsight bias and may expose the organization to liability.",
      how_to_proceed: "Rewrite using neutral, observable language only.",
      original_content: text
    };
  }
  return null;
}

const OUTCOME_PATTERNS = [
  /patient (died|expired|passed away)/i,
  /resulted in/i,
  /led to (harm|injury|death)/i,
  /adverse outcome/i,
  /in retrospect/i,
  /looking back/i,
  /if only/i,
  /we now know/i,
  /after the fact/i,
  /subsequent (deterioration|decline)/i,
  /ultimately/i,
  /turned out/i
];

function scanForOutcomeKnowledge(text: string): RefusalResult | null {
  for (const pattern of OUTCOME_PATTERNS) {
    if (pattern.test(text)) {
      return {
        status: "quarantined",
        reason_code: REASON_CODES.R004.code,
        what_happened: "Outcome knowledge contamination detected in decision-time context.",
        why_it_matters: "Outcome-derived information cannot appear in sections evaluating decision-time conditions.",
        how_to_proceed: "Move this information to the System Learning section or exclude entirely.",
        original_content: text
      };
    }
  }
  return null;
}

function hasOutcomeKnowledge(text: string): boolean {
  for (const pattern of OUTCOME_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function sanitizeDecisionTimeContent(text: string, refusals: RefusalResult[]): { sanitized: string; quarantined: boolean } {
  const prohibited = detectProhibitedTerms(text);
  const hasOutcome = hasOutcomeKnowledge(text);
  
  if (prohibited.length > 0) {
    refusals.push({
      status: "rewritten",
      reason_code: REASON_CODES.R003.code,
      what_happened: `Evaluative language detected: "${prohibited.join('", "')}"`,
      why_it_matters: "Evaluative terms introduce hindsight bias.",
      how_to_proceed: "Content has been redacted.",
      original_content: text
    });
    
    let sanitized = text;
    for (const term of prohibited) {
      const regex = new RegExp(term, "gi");
      sanitized = sanitized.replace(regex, "[REDACTED]");
    }
    return { sanitized, quarantined: hasOutcome };
  }
  
  if (hasOutcome) {
    refusals.push({
      status: "quarantined",
      reason_code: REASON_CODES.R004.code,
      what_happened: "Outcome knowledge contamination detected.",
      why_it_matters: "Outcome-derived information cannot appear in decision-time sections.",
      how_to_proceed: "Content has been quarantined.",
      original_content: text
    });
    return { sanitized: "[OUTCOME CONTENT QUARANTINED]", quarantined: true };
  }
  
  return { sanitized: text, quarantined: false };
}

function sanitizeText(text: string, refusals: RefusalResult[]): string {
  const evalCheck = scanForEvaluativeLanguage(text);
  if (evalCheck) {
    refusals.push(evalCheck);
  }
  
  const prohibited = detectProhibitedTerms(text);
  if (prohibited.length > 0) {
    let sanitized = text;
    for (const term of prohibited) {
      const regex = new RegExp(term, "gi");
      sanitized = sanitized.replace(regex, "[REDACTED]");
    }
    return sanitized;
  }
  return text;
}

function enforceProhibitedContentRemoval(report: IncidentReport): IncidentReport {
  const checkAndRedact = (text: string): string => {
    const prohibited = detectProhibitedTerms(text);
    if (prohibited.length === 0) return text;
    
    let result = text;
    for (const term of prohibited) {
      const regex = new RegExp(term, "gi");
      result = result.replace(regex, "[REDACTED]");
    }
    return result;
  };
  
  return {
    ...report,
    decision_under_review: {
      ...report.decision_under_review,
      decision_point: checkAndRedact(report.decision_under_review.decision_point),
      setting: report.decision_under_review.setting ? checkAndRedact(report.decision_under_review.setting) : undefined
    },
    evidence_snapshot: {
      admitted: report.evidence_snapshot.admitted.map(e => ({
        ...e,
        description: checkAndRedact(e.description)
      })),
      missing_or_pending: report.evidence_snapshot.missing_or_pending.map(e => ({
        ...e,
        description: checkAndRedact(e.description)
      })),
      excluded_outcome_info: report.evidence_snapshot.excluded_outcome_info.map(e => ({
        ...e,
        description: checkAndRedact(e.description)
      }))
    },
    timeline: report.timeline.map(t => ({
      ...t,
      event_label: checkAndRedact(t.event_label),
      what_happened: checkAndRedact(t.what_happened)
    })),
    claim_boundaries: {
      ...report.claim_boundaries,
      permitted_statements: report.claim_boundaries.permitted_statements.map(checkAndRedact)
    },
    governance_output: {
      ...report.governance_output,
      constraints: report.governance_output.constraints.map(c => ({
        ...c,
        statement: checkAndRedact(c.statement)
      }))
    },
    system_learning: {
      ...report.system_learning,
      notes: report.system_learning.notes.map(checkAndRedact),
      improvement_opportunities: report.system_learning.improvement_opportunities.map(o => ({
        ...o,
        description: checkAndRedact(o.description)
      })),
      candidate_mitigations: report.system_learning.candidate_mitigations.map(checkAndRedact)
    },
    action_items: report.action_items.map(a => ({
      ...a,
      description: checkAndRedact(a.description)
    }))
  };
}

function validateDecisionTarget(input: GenerateReportInput): RefusalResult | null {
  if (!input.decision_point || input.decision_point.trim() === "") {
    return {
      status: "refused",
      reason_code: REASON_CODES.P003.code,
      what_happened: "Decision target is undefined or empty.",
      why_it_matters: "A report cannot be generated without a clearly defined decision point.",
      how_to_proceed: "Provide a specific decision point (e.g., 'Discharge from ED after imaging')."
    };
  }
  return null;
}

function validateTimelineOrdering(events: TimelineEvent[]): { valid: boolean; disputed: string[] } {
  const disputed: string[] = [];
  
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    
    if (prev.verification_status === "disputed" || curr.verification_status === "disputed") {
      disputed.push(`Timeline ordering disputed between "${prev.event_label}" and "${curr.event_label}"`);
    }
  }
  
  return { valid: disputed.length === 0, disputed };
}

function generatePermittedStatements(evidence: EvidenceItem[]): string[] {
  const statements: string[] = [];
  
  for (const item of evidence) {
    if (item.confidence === "high") {
      statements.push(`The record supports that ${item.description} was documented at ${item.time_anchor}.`);
    } else if (item.confidence === "medium") {
      statements.push(`The record indicates that ${item.description} was available at ${item.time_anchor}, with partial verification.`);
    }
  }
  
  return statements;
}

function generateGovernanceConstraints(
  constraints: GenerateReportInput["constraints"],
  evidenceRefs: string[]
): GovernanceConstraint[] {
  const result: GovernanceConstraint[] = [];
  
  if (constraints.time_pressure) {
    result.push({
      constraint_id: generateId("GC"),
      statement: "Certainty regarding foreseeability is limited given documented time pressure constraints.",
      evidence_refs: evidenceRefs.filter(r => r.includes("time"))
    });
  }
  
  if (constraints.resource_limits) {
    result.push({
      constraint_id: generateId("GC"),
      statement: "Resource availability at decision time limits claims about alternative actions.",
      evidence_refs: evidenceRefs
    });
  }
  
  if (constraints.signal_quality_limits) {
    result.push({
      constraint_id: generateId("GC"),
      statement: "Signal quality limitations at decision time constrain retrospective evaluation.",
      evidence_refs: evidenceRefs
    });
  }
  
  if (constraints.guideline_ambiguity) {
    result.push({
      constraint_id: generateId("GC"),
      statement: "Guideline ambiguity at decision time precludes claims of protocol deviation.",
      evidence_refs: evidenceRefs
    });
  }
  
  result.push({
    constraint_id: generateId("GC"),
    statement: "This review does not establish negligence, intent, or standard-of-care compliance.",
    evidence_refs: []
  });
  
  return result;
}

export function generateIncidentReport(input: GenerateReportInput): GenerateReportResult {
  const refusals: RefusalResult[] = [];
  const errors: string[] = [];
  
  const decisionCheck = validateDecisionTarget(input);
  if (decisionCheck) {
    refusals.push(decisionCheck);
    
    const rejectedReport: IncidentReport = {
      report_version: "report_v1",
      case_id: input.case_id || generateId("CASE"),
      organization: input.organization,
      generated_at: new Date().toISOString(),
      environment: input.environment,
      status: "REJECTED",
      authoring_mode: "system_generated",
      data_sources: [],
      scope_limits_block_id: input.scope_variant,
      decision_under_review: {
        decision_point: "",
        window_start: input.window_start,
        window_end: input.window_end,
        decision_maker_role: input.decision_maker_role,
        setting: input.setting
      },
      evidence_snapshot: { admitted: [], missing_or_pending: [], excluded_outcome_info: [] },
      constraints: {
        time_pressure: false,
        competing_demands: false,
        resource_limits: false,
        guideline_ambiguity: false,
        handoffs_fragmentation: false,
        irreversibility: false,
        signal_quality_limits: false,
        constraint_evidence_refs: []
      },
      timeline: [],
      claim_boundaries: { permitted_statements: [], disallowed_claims: DISALLOWED_CLAIMS },
      governance_output: { authority_tier: "advisory_only", constraints: [] },
      system_learning: { notes: [], improvement_opportunities: [], candidate_mitigations: [] },
      action_items: [],
      refusal_log: [{
        reason_code: REASON_CODES.P003.code,
        attempted_content: "Report generation",
        allowed_rewrite: null,
        disposition: "rejected"
      }],
      finalization: { immutable_state: "draft", artifact_hash: null, previous_hash: null, signature: null }
    };
    
    return {
      success: false,
      report: rejectedReport,
      markdown: generateMarkdown(rejectedReport),
      refusals,
      errors: ["Decision target undefined"]
    };
  }
  
  const caseId = input.case_id || generateId("CASE");
  const dataSources: string[] = [];
  
  let hasQuarantinedContent = false;
  
  const admittedEvidence: EvidenceItem[] = input.admitted_evidence.map((item, idx) => {
    const { sanitized: sanitizedDesc, quarantined } = sanitizeDecisionTimeContent(item.description, refusals);
    if (quarantined) hasQuarantinedContent = true;
    dataSources.push(item.source_type);
    return {
      item_id: generateId("EV"),
      description: sanitizedDesc,
      source_type: item.source_type,
      time_anchor: item.time_anchor,
      confidence: item.confidence
    };
  });
  
  const missingEvidence: EvidenceItem[] = input.missing_pending.map((item, idx) => {
    const { sanitized, quarantined } = sanitizeDecisionTimeContent(item.description, refusals);
    if (quarantined) hasQuarantinedContent = true;
    return {
      item_id: generateId("EV"),
      description: sanitized,
      source_type: item.source_type,
      time_anchor: item.time_anchor,
      confidence: "low" as const
    };
  });
  
  const excludedEvidence: EvidenceItem[] = input.excluded_outcome_info.map((item, idx) => ({
    item_id: generateId("EV"),
    description: item.description,
    source_type: item.source_type,
    time_anchor: item.time_anchor,
    confidence: "high" as const
  }));
  
  const timelineEvents: TimelineEvent[] = input.timeline_events.map((event, idx) => {
    const { sanitized: sanitizedEvent, quarantined: q1 } = sanitizeDecisionTimeContent(event.what_happened, refusals);
    const { sanitized: sanitizedLabel, quarantined: q2 } = sanitizeDecisionTimeContent(event.event_label, refusals);
    if (q1 || q2) hasQuarantinedContent = true;
    return {
      timestamp: event.timestamp,
      event_label: sanitizedLabel,
      what_happened: sanitizedEvent,
      source_refs: event.source_refs,
      verification_status: event.verification_status
    };
  });
  
  const timelineValidation = validateTimelineOrdering(timelineEvents);
  let status: ReportStatus = "ADMISSIBLE";
  
  if (!timelineValidation.valid) {
    status = "DISPUTED";
    for (const dispute of timelineValidation.disputed) {
      refusals.push({
        status: "quarantined",
        reason_code: REASON_CODES.A001.code,
        what_happened: dispute,
        why_it_matters: "Disputed timeline ordering reduces report authority.",
        how_to_proceed: "Verify timestamps or mark affected events as disputed."
      });
    }
  }
  
  if (hasQuarantinedContent && status === "ADMISSIBLE") {
    status = "QUARANTINED";
  }
  
  if (input.narrative_input) {
    const narrativeCheck = scanForEvaluativeLanguage(input.narrative_input);
    const outcomeCheck = scanForOutcomeKnowledge(input.narrative_input);
    
    if (narrativeCheck) {
      refusals.push(narrativeCheck);
      status = "SCRAPBOOKED";
    }
    if (outcomeCheck) {
      refusals.push(outcomeCheck);
      if (status === "ADMISSIBLE") status = "QUARANTINED";
    }
  }
  
  const constraintEvidenceRefs = admittedEvidence.map(e => e.item_id);
  const permittedStatements = generatePermittedStatements(admittedEvidence);
  const governanceConstraints = generateGovernanceConstraints(
    input.constraints,
    constraintEvidenceRefs
  );
  
  const improvementOpportunities: ImprovementOpportunity[] = input.improvement_notes.map((note, idx) => ({
    id: generateId("IMP"),
    description: note,
    evidence_basis: excludedEvidence.map(e => e.item_id)
  }));
  
  const actionItems: ActionItem[] = input.action_items.map((item, idx) => ({
    id: generateId("ACT"),
    description: sanitizeText(item.description, refusals),
    owner_role: item.owner_role,
    due_date: item.due_date || null,
    verification_method: item.verification_method || null
  }));
  
  const refusalLog: RefusalLogEntry[] = refusals.map(r => ({
    reason_code: r.reason_code,
    attempted_content: r.original_content ? r.original_content.slice(0, 100) + "..." : "[content quarantined]",
    allowed_rewrite: r.rewritten_content || null,
    disposition: r.status === "refused" ? "rejected" as const : 
                 r.status === "rewritten" ? "rewritten" as const : "quarantined" as const
  }));
  
  const { sanitized: sanitizedDecisionPoint, quarantined: dpQ } = sanitizeDecisionTimeContent(input.decision_point, refusals);
  const { sanitized: sanitizedSetting, quarantined: stQ } = input.setting 
    ? sanitizeDecisionTimeContent(input.setting, refusals)
    : { sanitized: undefined, quarantined: false };
  if ((dpQ || stQ) && status === "ADMISSIBLE") {
    status = "QUARANTINED";
  }
  
  const report: IncidentReport = {
    report_version: "report_v1",
    case_id: caseId,
    organization: input.organization,
    generated_at: new Date().toISOString(),
    environment: input.environment,
    status,
    authoring_mode: "system_generated",
    data_sources: [...new Set(dataSources)],
    scope_limits_block_id: input.scope_variant,
    decision_under_review: {
      decision_point: sanitizedDecisionPoint,
      window_start: input.window_start,
      window_end: input.window_end,
      decision_maker_role: input.decision_maker_role,
      setting: sanitizedSetting
    },
    evidence_snapshot: {
      admitted: admittedEvidence,
      missing_or_pending: missingEvidence,
      excluded_outcome_info: excludedEvidence
    },
    constraints: {
      time_pressure: input.constraints.time_pressure ?? false,
      competing_demands: input.constraints.competing_demands ?? false,
      resource_limits: input.constraints.resource_limits ?? false,
      guideline_ambiguity: input.constraints.guideline_ambiguity ?? false,
      handoffs_fragmentation: input.constraints.handoffs_fragmentation ?? false,
      irreversibility: input.constraints.irreversibility ?? false,
      signal_quality_limits: input.constraints.signal_quality_limits ?? false,
      constraint_evidence_refs: constraintEvidenceRefs
    },
    timeline: timelineEvents,
    claim_boundaries: {
      permitted_statements: permittedStatements,
      disallowed_claims: DISALLOWED_CLAIMS
    },
    governance_output: {
      authority_tier: "advisory_only",
      constraints: governanceConstraints
    },
    system_learning: {
      notes: input.improvement_notes,
      improvement_opportunities: improvementOpportunities,
      candidate_mitigations: []
    },
    action_items: actionItems,
    refusal_log: refusalLog,
    finalization: {
      immutable_state: "draft",
      artifact_hash: null,
      previous_hash: null,
      signature: null
    }
  };
  
  const sanitizedReport = enforceProhibitedContentRemoval(report);
  
  const validation = IncidentReportSchema.safeParse(sanitizedReport);
  if (!validation.success) {
    errors.push(`Schema validation failed: ${validation.error.message}`);
    if (sanitizedReport.status === "ADMISSIBLE") {
      sanitizedReport.status = "REJECTED";
      sanitizedReport.refusal_log.push({
        reason_code: REASON_CODES.R001.code,
        attempted_content: "Final report validation",
        allowed_rewrite: null,
        disposition: "rejected"
      });
    }
  }
  
  const markdown = generateMarkdown(sanitizedReport);
  
  return {
    success: validation.success,
    report: sanitizedReport,
    markdown,
    refusals,
    errors
  };
}

export function finalizeReport(report: IncidentReport, previousHash?: string): IncidentReport {
  const canonical = canonicalJson(report);
  const hash = computeHash(canonical);
  
  return {
    ...report,
    finalization: {
      immutable_state: "finalized",
      artifact_hash: hash,
      previous_hash: previousHash || null,
      signature: null
    }
  };
}

export function generateMarkdown(report: IncidentReport): string {
  const scopeText = SCOPE_LIMITS_VARIANTS[report.scope_limits_block_id as keyof typeof SCOPE_LIMITS_VARIANTS];
  
  const lines: string[] = [
    `# Independent Post-Incident Review Record`,
    `## (Advisory / Non-Adjudicative)`,
    ``,
    `---`,
    ``,
    `## 1. Header / Metadata`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Case ID | ${report.case_id} |`,
    `| Organization | ${report.organization || "Not specified"} |`,
    `| Generated At | ${report.generated_at} |`,
    `| Report Version | ${report.report_version} |`,
    `| Environment | ${report.environment} |`,
    `| Authoring Mode | ${report.authoring_mode} |`,
    `| Status | **${report.status}** |`,
    `| Data Sources | ${report.data_sources.join(", ") || "None specified"} |`,
    ``,
    `### Integrity Fields`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Immutable State | ${report.finalization.immutable_state} |`,
    `| Artifact Hash | ${report.finalization.artifact_hash || "Not finalized"} |`,
    `| Previous Hash | ${report.finalization.previous_hash || "N/A"} |`,
    ``,
    `---`,
    ``,
    `## 2. Scope & Limits`,
    ``,
    `> ${scopeText}`,
    ``,
    `---`,
    ``,
    `## 3. Decision Under Review`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Decision Point | ${report.decision_under_review.decision_point || "UNDEFINED"} |`,
    `| Window Start | ${report.decision_under_review.window_start} |`,
    `| Window End | ${report.decision_under_review.window_end} |`,
    `| Decision Maker Role | ${report.decision_under_review.decision_maker_role} |`,
    `| Setting | ${report.decision_under_review.setting || "Not specified"} |`,
    ``,
    `---`,
    ``,
    `## 4. Decision-Time Evidence Snapshot`,
    ``,
    `### 4.1 Admitted Information (Decision-Time)`,
    ``
  ];
  
  if (report.evidence_snapshot.admitted.length === 0) {
    lines.push(`*No evidence items admitted.*`);
  } else {
    lines.push(`| ID | Description | Source | Time Anchor | Confidence |`);
    lines.push(`|----|-------------|--------|-------------|------------|`);
    for (const item of report.evidence_snapshot.admitted) {
      lines.push(`| ${item.item_id} | ${item.description} | ${item.source_type} | ${item.time_anchor} | ${item.confidence} |`);
    }
  }
  
  lines.push(``);
  lines.push(`### 4.2 Pending / Missing at Decision Time`);
  lines.push(``);
  
  if (report.evidence_snapshot.missing_or_pending.length === 0) {
    lines.push(`*No pending or missing items documented.*`);
  } else {
    lines.push(`| ID | Description | Source | Time Anchor |`);
    lines.push(`|----|-------------|--------|-------------|`);
    for (const item of report.evidence_snapshot.missing_or_pending) {
      lines.push(`| ${item.item_id} | ${item.description} | ${item.source_type} | ${item.time_anchor} |`);
    }
  }
  
  lines.push(``);
  lines.push(`### 4.3 Explicitly Excluded Information (Post-Decision / Outcome Knowledge)`);
  lines.push(``);
  
  if (report.evidence_snapshot.excluded_outcome_info.length === 0) {
    lines.push(`*No excluded outcome information.*`);
  } else {
    lines.push(`| ID | Description | Source | Time Anchor |`);
    lines.push(`|----|-------------|--------|-------------|`);
    for (const item of report.evidence_snapshot.excluded_outcome_info) {
      lines.push(`| ${item.item_id} | ${item.description} | ${item.source_type} | ${item.time_anchor} |`);
    }
  }
  
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 5. Constraints & Conditions`);
  lines.push(``);
  lines.push(`| Constraint | Present |`);
  lines.push(`|------------|---------|`);
  lines.push(`| Time Pressure | ${report.constraints.time_pressure ? "Yes" : "No"} |`);
  lines.push(`| Competing Demands | ${report.constraints.competing_demands ? "Yes" : "No"} |`);
  lines.push(`| Resource/Staffing Limits | ${report.constraints.resource_limits ? "Yes" : "No"} |`);
  lines.push(`| Guideline Ambiguity | ${report.constraints.guideline_ambiguity ? "Yes" : "No"} |`);
  lines.push(`| Handoffs/Fragmentation | ${report.constraints.handoffs_fragmentation ? "Yes" : "No"} |`);
  lines.push(`| Irreversible Decision Context | ${report.constraints.irreversibility ? "Yes" : "No"} |`);
  lines.push(`| Signal Quality Limits | ${report.constraints.signal_quality_limits ? "Yes" : "No"} |`);
  lines.push(``);
  
  if (report.constraints.constraint_evidence_refs.length > 0) {
    lines.push(`**Evidence References:** ${report.constraints.constraint_evidence_refs.join(", ")}`);
    lines.push(``);
  }
  
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 6. Admissible Timeline`);
  lines.push(``);
  
  if (report.timeline.length === 0) {
    lines.push(`*No timeline events documented.*`);
  } else {
    lines.push(`| Timestamp | Event | What Happened | Sources | Verification |`);
    lines.push(`|-----------|-------|---------------|---------|--------------|`);
    for (const event of report.timeline) {
      lines.push(`| ${event.timestamp} | ${event.event_label} | ${event.what_happened} | ${event.source_refs.join(", ")} | ${event.verification_status} |`);
    }
  }
  
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 7. Claim Boundaries`);
  lines.push(``);
  lines.push(`### 7.1 Permitted Statements (Bounded)`);
  lines.push(``);
  
  if (report.claim_boundaries.permitted_statements.length === 0) {
    lines.push(`*No permitted statements generated.*`);
  } else {
    for (const stmt of report.claim_boundaries.permitted_statements) {
      lines.push(`- ${stmt}`);
    }
  }
  
  lines.push(``);
  lines.push(`### 7.2 Disallowed Claims`);
  lines.push(``);
  lines.push(`The following claim categories are explicitly prohibited in this review:`);
  lines.push(``);
  for (const claim of report.claim_boundaries.disallowed_claims) {
    lines.push(`- [ ] ${claim}`);
  }
  
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 8. Governance Output (Constraints, Not Conclusions)`);
  lines.push(``);
  lines.push(`**Authority Tier:** ${report.governance_output.authority_tier}`);
  lines.push(``);
  lines.push(`### Governance Constraints`);
  lines.push(``);
  
  if (report.governance_output.constraints.length === 0) {
    lines.push(`*No governance constraints specified.*`);
  } else {
    for (const constraint of report.governance_output.constraints) {
      lines.push(`- **${constraint.constraint_id}**: ${constraint.statement}`);
      if (constraint.evidence_refs.length > 0) {
        lines.push(`  - Evidence: ${constraint.evidence_refs.join(", ")}`);
      }
    }
  }
  
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 9. System Learning (Outcome-Informed - Allowed Here Only)`);
  lines.push(``);
  lines.push(`> *For system redesign / process improvement only. No retroactive attribution to decision maker.*`);
  lines.push(``);
  
  if (report.system_learning.notes.length > 0) {
    lines.push(`### Notes`);
    for (const note of report.system_learning.notes) {
      lines.push(`- ${note}`);
    }
    lines.push(``);
  }
  
  if (report.system_learning.improvement_opportunities.length > 0) {
    lines.push(`### Improvement Opportunities`);
    for (const opp of report.system_learning.improvement_opportunities) {
      lines.push(`- **${opp.id}**: ${opp.description}`);
      if (opp.evidence_basis.length > 0) {
        lines.push(`  - Evidence basis: ${opp.evidence_basis.join(", ")}`);
      }
    }
    lines.push(``);
  }
  
  if (report.system_learning.candidate_mitigations.length > 0) {
    lines.push(`### Candidate Mitigations`);
    for (const mit of report.system_learning.candidate_mitigations) {
      lines.push(`- ${mit}`);
    }
    lines.push(``);
  }
  
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 10. Action Items`);
  lines.push(``);
  
  if (report.action_items.length === 0) {
    lines.push(`*No action items specified.*`);
  } else {
    lines.push(`| ID | Description | Owner Role | Due Date | Verification |`);
    lines.push(`|----|-------------|------------|----------|--------------|`);
    for (const item of report.action_items) {
      lines.push(`| ${item.id} | ${item.description} | ${item.owner_role} | ${item.due_date || "TBD"} | ${item.verification_method || "TBD"} |`);
    }
  }
  
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 11. Refusal / Quarantine Log`);
  lines.push(``);
  
  if (report.refusal_log.length === 0) {
    lines.push(`*No refusals or quarantines recorded. All inputs admitted.*`);
  } else {
    lines.push(`| Reason Code | Attempted Content | Allowed Rewrite | Disposition |`);
    lines.push(`|-------------|-------------------|-----------------|-------------|`);
    for (const entry of report.refusal_log) {
      lines.push(`| ${entry.reason_code} | ${entry.attempted_content.slice(0, 50)}... | ${entry.allowed_rewrite || "None"} | ${entry.disposition} |`);
    }
  }
  
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 12. Finalization & Verification`);
  lines.push(``);
  
  if (report.finalization.immutable_state === "finalized") {
    lines.push(`> **This record is finalized and may not be edited.**`);
    lines.push(`> Corrections are additive: new artifacts may be appended but originals remain unchanged.`);
    lines.push(``);
    lines.push(`### Verification Instructions`);
    lines.push(``);
    lines.push(`To verify this artifact:`);
    lines.push(`1. Parse the canonical JSON representation`);
    lines.push(`2. Compute SHA-256 hash of the canonical JSON`);
    lines.push(`3. Compare with artifact_hash: \`${report.finalization.artifact_hash}\``);
  } else {
    lines.push(`**Status:** DRAFT - Not yet finalized`);
    lines.push(``);
    lines.push(`This report must be finalized before it can be used as an official record.`);
  }
  
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`*Generated by Lantern Incident Report System v1.0*`);
  lines.push(`*Report Schema: ${report.report_version}*`);
  
  return lines.join("\n");
}

export function computeReportHash(report: IncidentReport): string {
  const canonical = canonicalJson(report);
  return computeHash(canonical);
}
