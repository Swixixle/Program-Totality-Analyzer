export type Evidence = {
  path: string;
  line_start: number;
  line_end: number;
  snippet_hash: string;
  snippet_hash_verified?: boolean;
  display?: string;
};

export type HowtoStep = {
  step?: string;
  command?: string | null;
  description?: string;
  evidence?: Evidence | Evidence[] | null;
};

export type ConfigItem = {
  name: string;
  purpose?: string;
  source?: string;
  evidence?: Evidence | Evidence[] | null;
};

export type CommonFailure = {
  symptom: string;
  cause: string;
  fix: string;
  evidence?: Evidence | Evidence[] | null;
};

export type UsageExample = {
  description: string;
  command: string;
};

export type HowtoObject = {
  prereqs?: { runtime?: string; name?: string; version?: string; command?: string; evidence?: Evidence | Evidence[] | null }[];
  install_steps?: HowtoStep[];
  config?: ConfigItem[];
  run_dev?: HowtoStep | HowtoStep[];
  run_prod?: HowtoStep | HowtoStep[];
  usage_examples?: UsageExample[];
  verification_steps?: HowtoStep[];
  common_failures?: CommonFailure[];
  unknowns?: any[];
  completeness?: any;
  missing_evidence_requests?: string[];
};

export type Claim = {
  id: string;
  status: "evidenced" | "inferred" | "unknown";
  section: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
};

export type ClaimsWrapper = {
  mode: string;
  run_id: string;
  is_replit: boolean;
  claims: Claim[];
};

export type Unknown = {
  what_is_missing: string;
  why_it_matters: string;
  what_evidence_needed: string;
};

export type Analysis = {
  id: number;
  projectId: number;
  dossier: string | null;
  claims: ClaimsWrapper | Claim[] | null;
  howto: HowtoObject | HowtoStep[] | null;
  coverage: Record<string, any> | null;
  unknowns: (Unknown | string)[] | null;
  createdAt: string;
};
