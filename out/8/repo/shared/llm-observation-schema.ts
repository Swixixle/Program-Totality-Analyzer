/**
 * LLM Observation Schema v1.0
 * 
 * LLMs are SENSORS, not arbiters.
 * They may observe, summarize, or flag, but they may NEVER decide
 * truth, validity, intent, or correctness.
 * 
 * DESIGN PRINCIPLES:
 * 1. LLM outputs are DESCRIPTIVE, never evaluative
 * 2. All outputs include mandatory disclaimers
 * 3. LLM observations are DATA-ISOLATED from verification/forensics
 * 4. Language must be hedged (may, appears, could) never absolute (is, means, proves)
 * 5. LLM outputs NEVER enter the research dataset
 */

import { z } from "zod";

export const LLM_OBSERVATION_SCHEMA_VERSION = "llm-observation/1.0";

/**
 * Allowed observation types
 * These describe WHAT the LLM is doing, not WHAT it concludes
 */
export const observationTypeSchema = z.enum([
  "paraphrase",       // Restating content without adding conclusions
  "ambiguity",        // Surfacing possible multiple interpretations
  "disagreement",     // Noting where models differ
  "tone",             // Describing language-level signals
  "structure",        // Describing organizational patterns
  "hedging",          // Identifying confidence markers
  "refusal_pattern",  // Noting refusal vs compliance styles
]);

export type ObservationType = z.infer<typeof observationTypeSchema>;

/**
 * Source of transcript being observed
 */
export const observationBasisSchema = z.enum([
  "submitted_transcript",  // UNVERIFIED source (hash mismatch or no verification)
  "verified_transcript",   // VERIFIED source (hash match confirmed)
]);

export type ObservationBasis = z.infer<typeof observationBasisSchema>;

/**
 * Provider allowlist
 */
export const PROVIDER_ALLOWLIST = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "meta",
  "mistral",
  "cohere",
  "perplexity",
  "deepseek",
  "qwen",
  "mock",
  "other",
] as const;

export type ProviderName = typeof PROVIDER_ALLOWLIST[number];

/**
 * Model ID format: provider:model
 * Examples: openai:gpt-4o, anthropic:claude-3-opus, mock:mock-sensor
 */
export const MODEL_ID_REGEX = /^[a-z0-9_-]+:[a-z0-9_.-]+$/;

export const modelIdSchema = z.string().regex(MODEL_ID_REGEX, {
  message: "Invalid model_id format. Expected: provider:model (e.g., openai:gpt-4o)"
});

export type ModelId = z.infer<typeof modelIdSchema>;

/**
 * Legacy model ID mapping for backward compatibility
 */
export const LEGACY_MODEL_MAP: Record<string, string> = {
  "gpt-4o": "openai:gpt-4o",
  "gpt-4-turbo": "openai:gpt-4-turbo",
  "claude-3-opus": "anthropic:claude-3-opus",
  "claude-3-sonnet": "anthropic:claude-3-sonnet",
  "claude-3-haiku": "anthropic:claude-3-haiku",
  "gemini-1.5-pro": "google:gemini-1.5-pro",
  "gemini-1.5-flash": "google:gemini-1.5-flash",
  "mock-sensor": "mock:mock-sensor",
};

/**
 * Standard limitations that MUST be included
 */
export const STANDARD_LIMITATIONS = [
  "Model may miss context",
  "Model does not assess truth or accuracy",
  "Observation is language-pattern based, not fact-based",
  "Multiple valid interpretations may exist",
] as const;

/**
 * Standard confidence statement (MANDATORY)
 */
export const CONFIDENCE_STATEMENT = 
  "This is a model-generated observation, not a factual determination.";

/**
 * LLM Observation output schema (MANDATORY STRUCTURE)
 * All LLM outputs MUST conform to this shape
 */
export const llmObservationSchema = z.object({
  schema: z.literal(LLM_OBSERVATION_SCHEMA_VERSION),
  observation_id: z.string().uuid(),
  receipt_id: z.string(),
  model_id: modelIdSchema,
  observation_type: observationTypeSchema,
  based_on: observationBasisSchema,
  content: z.string().max(2000),
  confidence_statement: z.literal(CONFIDENCE_STATEMENT),
  limitations: z.array(z.string()).min(2),
  created_at: z.string().datetime(),
});

export type LlmObservation = z.infer<typeof llmObservationSchema>;

/**
 * Request to generate an LLM observation
 * NOTE: receipt_id comes from URL path, not body
 * NOTE: This explicitly does NOT include verification/forensic data
 */
export const llmObservationRequestSchema = z.object({
  observation_type: observationTypeSchema,
  model_id: modelIdSchema.optional(),
});

export type LlmObservationRequest = z.infer<typeof llmObservationRequestSchema>;

/**
 * Multi-model observation request (for disagreement detection)
 * NOTE: receipt_id comes from URL path, not body
 */
export const multiModelObservationRequestSchema = z.object({
  observation_type: observationTypeSchema,
  model_ids: z.array(modelIdSchema).min(2).max(4),
});

export type MultiModelObservationRequest = z.infer<typeof multiModelObservationRequestSchema>;

/**
 * FORBIDDEN WORDS in LLM output
 * If any of these appear in content, the observation is REJECTED
 */
export const FORBIDDEN_WORDS = [
  "correct",
  "incorrect",
  "true",
  "false",
  "hallucination",
  "hallucinating",
  "accurate",
  "inaccurate",
  "wrong",
  "right",
  "proves",
  "proven",
  "confirms",
  "verified",     // LLM cannot use verification language
  "invalid",
  "valid",
  "therefore",
  "this means",
  "this proves",
  "the answer is",
  "the correct answer",
  "misleading",
  "deceptive",
  "lying",
  "truthful",
] as const;

/**
 * REQUIRED HEDGING WORDS
 * Content should use these tentative forms
 */
export const HEDGING_WORDS = [
  "may",
  "might",
  "appears",
  "could",
  "seems",
  "possibly",
  "potentially",
  "suggests",
  "indicates",
  "one interpretation",
  "could be interpreted as",
] as const;

/**
 * Validate that content follows language hygiene rules
 * Returns array of violations (empty = valid)
 */
export function validateLanguageHygiene(content: string): string[] {
  const violations: string[] = [];
  const lowerContent = content.toLowerCase();
  
  for (const forbidden of FORBIDDEN_WORDS) {
    if (lowerContent.includes(forbidden.toLowerCase())) {
      violations.push(`Forbidden word detected: "${forbidden}"`);
    }
  }
  
  return violations;
}

/**
 * Check if content uses appropriate hedging
 * Returns true if at least one hedging word is present
 */
export function hasAppropriateHedging(content: string): boolean {
  const lowerContent = content.toLowerCase();
  return HEDGING_WORDS.some(word => lowerContent.includes(word.toLowerCase()));
}
