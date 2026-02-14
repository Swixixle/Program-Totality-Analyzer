
// Heuristic Finding Types

export type FindingStatus = "sufficient" | "insufficient";

export interface HeuristicFinding {
  kind: string;
  packId: string;
  generatedAt: string;
  status: FindingStatus;
  threshold: number;
  processedCount: number;
  results: any[];
}

// M4.1 Influence Hubs
export interface InfluenceHubResult {
  entityId: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  supportingEdgeIds: string[];
}

export interface InfluenceHubsFinding extends HeuristicFinding {
  kind: "influence_hubs_v1";
  results: InfluenceHubResult[];
}

// M4.2 Funding Gravity
export interface FunderStat {
    entityId: string;
    outgoingFundingEdges: number;
    totalRecipients: number;
    supportingEdgeIds: string[];
}

export interface RecipientStat {
    entityId: string;
    incomingFundingEdges: number;
    totalFunders: number;
    supportingEdgeIds: string[];
}

export interface FundingGravityFinding extends HeuristicFinding {
  kind: "funding_gravity_v1";
  packId: string;
  generatedAt: string;
  funders: FunderStat[];
  recipients: RecipientStat[];
  concentration?: {
    topFundersShare: number; // 0..1 share of all funding edges owned by top funder
    topRecipientsShare: number; // 0..1 share of all funding edges owned by top recipient
    edgesCount: number;
  };
  notes?: string;
}

// M4.3 Enforcement Map
export interface EnforcerStat {
  entityId: string;
  enforcementActions: number; // Outgoing enforcement (being the enforcer)
  supportingEdgeIds: string[];
}

export interface TargetStat {
  entityId: string;
  targetedActions: number; // Incoming enforcement (being the target)
  supportingEdgeIds: string[];
}

export interface EnforcementMapFinding extends HeuristicFinding {
  kind: "enforcement_map_v1";
  packId: string;
  generatedAt: string;
  enforcers: EnforcerStat[];
  targets: TargetStat[];
  breakdownByType: Record<string, number>;
}

export type AnyHeuristicFinding = InfluenceHubsFinding | FundingGravityFinding | EnforcementMapFinding;
