/**
 * FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST
 * 
 * This is the ONLY location where forbidden terms may appear in UI copy.
 * The scanner explicitly allows these strings in this file only.
 * 
 * These terms describe capabilities that this system explicitly does NOT provide.
 */

export const FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST = [
  "LLM judgment",
  "Truth scoring",
  "Truth arbitration",
  "Model reconciliation",
  "Behavioral interpretation",
] as const;

export type ForbiddenCapability = typeof FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST[number];
