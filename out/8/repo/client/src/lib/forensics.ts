export interface ForensicsFlags {
  pii: boolean;
  piiCount: number;
  risk: boolean;
  riskCount: number;
  anom: boolean;
  anomCount: number;
}

export function parseForensics(forensicsJson: string | null | undefined): ForensicsFlags | null {
  if (!forensicsJson) return null;
  try {
    const f = typeof forensicsJson === "object" ? forensicsJson : JSON.parse(forensicsJson);

    const piiFields = ["email_like_count", "phone_like_count", "ssn_like_count", "dob_like_count", "mrn_like_count", "ip_like_count"];
    let piiCount = 0;
    if (f.pii_heuristics) {
      for (const k of piiFields) {
        piiCount += (f.pii_heuristics[k] || 0);
      }
    }

    const riskCategories = ["instructional", "medical", "legal", "financial", "self_harm"];
    let riskCount = 0;
    if (f.risk_keywords) {
      for (const k of riskCategories) {
        if (f.risk_keywords[k]?.present) riskCount++;
      }
    }

    const anomCount = Array.isArray(f.anomalies) ? f.anomalies.length : 0;

    return {
      pii: piiCount > 0,
      piiCount,
      risk: riskCount > 0,
      riskCount,
      anom: anomCount > 0,
      anomCount,
    };
  } catch {
    return null;
  }
}

export function hasAnyForensicsFlags(flags: ForensicsFlags | null): boolean {
  if (!flags) return false;
  return flags.pii || flags.risk || flags.anom;
}
