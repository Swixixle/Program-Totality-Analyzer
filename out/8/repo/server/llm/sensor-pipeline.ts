/**
 * LLM Sensor Pipeline (P6.3)
 * 
 * End-to-end flow for generating sensor observations:
 * 1. Kill switch check
 * 2. Model ID validation via adapter registry
 * 3. Adapter invocation with normalized error handling
 * 4. Policy enforcement (forbidden words, hedging, confidence, limitations)
 * 5. Schema-valid llm-observation/1.0 output
 * 
 * CRITICAL PRINCIPLE: LLMs are SENSORS, not ARBITERS
 * - LLM sees ONLY transcript content (DATA ISOLATION)
 * - LLM observations do NOT affect verification_status
 * - LLM observations are stored separately
 */

import { randomUUID } from "crypto";
import {
  getAdapterForModelId,
  checkSensorEnabled,
  AdapterError,
  type AdapterObservation,
} from "./adapters/index";
import { logForbiddenWords } from "../security-audit";

import {
  LLM_OBSERVATION_SCHEMA_VERSION,
  CONFIDENCE_STATEMENT,
  STANDARD_LIMITATIONS,
  validateLanguageHygiene,
  hasAppropriateHedging,
  type LlmObservation,
  type ObservationType,
  type ObservationBasis,
  type ModelId,
  LEGACY_MODEL_MAP,
} from "@shared/llm-observation-schema";

/**
 * Error categories for normalization contract
 */
export type SensorErrorCode =
  | "KILL_SWITCH_ENGAGED"    // Permanent block, observation disabled
  | "INVALID_MODEL_ID"       // 400 - bad format
  | "UNSUPPORTED_PROVIDER"   // 400 - provider not in allowlist
  | "SENSOR_DISABLED"        // 403 - not in ENABLED_SENSORS
  | "NOT_IMPLEMENTED"        // 501 - stub adapter, no API key
  | "PROVIDER_REFUSED"       // Provider safety/moderation block
  | "PROVIDER_TIMEOUT"       // Transient - retry may succeed
  | "PROVIDER_ERROR"         // Provider API error
  | "LANGUAGE_VIOLATION"     // LLM output contained forbidden words
  | "INTERNAL_ERROR";        // Unexpected error

export class SensorPipelineError extends Error {
  constructor(
    message: string,
    public code: SensorErrorCode,
    public status: number,
    public retryable: boolean = false,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SensorPipelineError";
  }

  static fromAdapterError(err: AdapterError): SensorPipelineError {
    const codeMap: Record<string, SensorErrorCode> = {
      INVALID_MODEL_ID: "INVALID_MODEL_ID",
      UNSUPPORTED_PROVIDER: "UNSUPPORTED_PROVIDER",
      NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
      API_ERROR: "PROVIDER_ERROR",
      SENSOR_DISABLED: "SENSOR_DISABLED",
    };
    return new SensorPipelineError(
      err.message,
      codeMap[err.code] || "INTERNAL_ERROR",
      err.status,
      false
    );
  }
}

/**
 * Pipeline input: transcript + observation request
 * ISOLATED: Does not include verification data
 */
export interface SensorPipelineInput {
  receiptId: string;
  transcript: {
    messages: Array<{ role: string; content: string }>;
  };
  basis: ObservationBasis;
  observationType: ObservationType;
  modelId: ModelId;
}

/**
 * Pipeline output: normalized result
 */
export type SensorPipelineResult = 
  | { success: true; observation: LlmObservation }
  | { success: false; error: SensorPipelineError };

/**
 * Normalize legacy model IDs to canonical format
 */
export function normalizeModelId(modelId: string): ModelId {
  if (LEGACY_MODEL_MAP[modelId]) {
    return LEGACY_MODEL_MAP[modelId] as ModelId;
  }
  return modelId as ModelId;
}

/**
 * Generate observation prompt based on type
 */
function getObservationPrompt(type: ObservationType, transcript: string): string {
  const baseInstructions = `
You are a language observation tool. You DESCRIBE patterns, you do NOT evaluate truth or correctness.

MANDATORY RULES:
- Use hedging language: "may", "appears", "could", "seems", "possibly"
- NEVER use: "correct", "incorrect", "true", "false", "hallucination", "proves", "confirms"
- NEVER make judgments about accuracy or validity
- NEVER use "therefore", "this means", or "this proves"
- Describe WHAT you observe, not WHAT it means

`;

  const typePrompts: Record<ObservationType, string> = {
    paraphrase: `${baseInstructions}
Task: Restate the key points of this conversation without adding conclusions or judgments.
Focus on WHAT was said, not whether it was correct.

Transcript:
${transcript}

Provide a neutral paraphrase (max 500 words):`,

    ambiguity: `${baseInstructions}
Task: Identify areas where the text could have multiple interpretations.
Focus on WHERE ambiguity exists, not WHICH interpretation is correct.

Transcript:
${transcript}

List potential ambiguities (max 500 words):`,

    disagreement: `${baseInstructions}
Task: Note any areas where different perspectives or interpretations may exist.
Do NOT suggest which perspective is correct.

Transcript:
${transcript}

Describe observable differences (max 500 words):`,

    tone: `${baseInstructions}
Task: Describe the language-level signals in this text.
Focus on hedging, confidence markers, and communication style.
Do NOT evaluate whether the tone is appropriate or correct.

Transcript:
${transcript}

Describe language patterns (max 500 words):`,

    structure: `${baseInstructions}
Task: Describe the organizational patterns in this conversation.
Focus on how the dialogue is structured, not whether it's correct.

Transcript:
${transcript}

Describe structural patterns (max 500 words):`,

    hedging: `${baseInstructions}
Task: Identify confidence markers and hedging language in the text.
Note phrases like "may", "might", "could", "I think", "possibly".
Do NOT evaluate whether the hedging is appropriate.

Transcript:
${transcript}

List hedging patterns observed (max 500 words):`,

    refusal_pattern: `${baseInstructions}
Task: Describe any refusal or compliance patterns observed.
Note HOW responses are framed, not WHETHER they should have refused.

Transcript:
${transcript}

Describe response patterns (max 500 words):`,
  };

  return typePrompts[type];
}

/**
 * Add hedging prefix if content lacks required hedging
 */
function addHedgingPrefix(content: string): string {
  return `This observation may be interpreted in multiple ways. ${content}`;
}

/**
 * Ensure limitations array has minimum required entries
 */
function ensureMinimumLimitations(limitations: string[]): string[] {
  if (limitations.length >= 2) {
    return limitations;
  }
  const result = [...limitations];
  while (result.length < 2) {
    const standardLim = STANDARD_LIMITATIONS[result.length];
    if (standardLim && !result.includes(standardLim)) {
      result.push(standardLim);
    } else {
      result.push(`Observation limitation #${result.length + 1}`);
    }
  }
  return result;
}

/**
 * Policy enforcement layer
 * Validates and transforms LLM output to meet sensor-mode requirements
 */
function enforcePolicy(
  rawContent: string,
  adapterOutput: AdapterObservation,
  observationType?: string
): { 
  content: string; 
  limitations: string[];
  hedgingAdded: boolean;
  limitationsAdded: boolean;
} {
  const violations = validateLanguageHygiene(rawContent);
  
  if (violations.length > 0) {
    logForbiddenWords(observationType ?? "unknown", violations.length);
    
    throw new SensorPipelineError(
      `LLM output rejected due to forbidden language: ${violations.join(", ")}. Sensor-mode requires neutral, observational language only.`,
      "LANGUAGE_VIOLATION",
      422,
      false,
      { violations }
    );
  }

  const needsHedging = !hasAppropriateHedging(rawContent);
  const content = needsHedging ? addHedgingPrefix(rawContent) : rawContent;

  const rawLimitations = adapterOutput.limitations || [];
  const needsLimitations = rawLimitations.length < 2;
  const limitations = ensureMinimumLimitations(rawLimitations);

  return {
    content,
    limitations,
    hedgingAdded: needsHedging,
    limitationsAdded: needsLimitations,
  };
}

/**
 * Execute the sensor pipeline
 * 
 * CRITICAL: This function is DATA-ISOLATED
 * - Receives ONLY transcript, not verification data
 * - Never mutates verification_status
 */
export async function runSensorPipeline(
  input: SensorPipelineInput,
  killSwitchEngaged: boolean
): Promise<SensorPipelineResult> {
  // Step 1: Kill switch check (first - blocks everything)
  if (killSwitchEngaged) {
    return {
      success: false,
      error: new SensorPipelineError(
        "Kill switch engaged - observations permanently disabled for this receipt",
        "KILL_SWITCH_ENGAGED",
        403,
        false
      ),
    };
  }

  try {
    // Step 2: Normalize and validate model ID
    const normalizedModelId = normalizeModelId(input.modelId);
    
    // Step 3: Check if sensor is enabled (if ENABLED_SENSORS is set)
    checkSensorEnabled(normalizedModelId);

    // Step 4: Get adapter via registry
    const { adapter, provider, model } = getAdapterForModelId(normalizedModelId);

    // Step 5: Format transcript for adapter
    const transcriptText = input.transcript.messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join("\n\n");

    // Step 6: Build adapter request
    const prompt = getObservationPrompt(input.observationType, transcriptText);
    const adapterRequest = adapter.buildRequest(
      { 
        messages: [
          { role: "system", content: prompt },
          ...input.transcript.messages
        ] 
      },
      { observation_type: input.observationType }
    );

    // Step 7: Execute adapter - dispatches to provider via adapter.execute()
    const adapterResponse = await adapter.execute(adapterRequest);

    // Step 8: Apply policy enforcement
    const policy = enforcePolicy(adapterResponse.observations, adapterResponse, input.observationType);

    if (policy.hedgingAdded) {
      console.log("[Sensor-Pipeline] Added hedging prefix to output lacking hedge words");
    }
    if (policy.limitationsAdded) {
      console.log("[Sensor-Pipeline] Added limitations to meet minimum requirement");
    }

    // Step 9: Build schema-valid observation
    const observation: LlmObservation = {
      schema: LLM_OBSERVATION_SCHEMA_VERSION,
      observation_id: randomUUID(),
      receipt_id: input.receiptId,
      model_id: normalizedModelId,
      observation_type: input.observationType,
      based_on: input.basis,
      content: policy.content,
      confidence_statement: CONFIDENCE_STATEMENT,
      limitations: policy.limitations,
      created_at: new Date().toISOString(),
    };

    return {
      success: true,
      observation,
    };

  } catch (error: any) {
    // Normalize errors
    if (error instanceof SensorPipelineError) {
      return { success: false, error };
    }

    if (error instanceof AdapterError) {
      return { 
        success: false, 
        error: SensorPipelineError.fromAdapterError(error) 
      };
    }

    // Handle timeout patterns
    if (error.code === "ETIMEDOUT" || error.message?.includes("timeout")) {
      return {
        success: false,
        error: new SensorPipelineError(
          `Provider timeout: ${error.message}`,
          "PROVIDER_TIMEOUT",
          504,
          true
        ),
      };
    }

    // Handle refusal/safety patterns
    if (error.message?.includes("content_policy") || 
        error.message?.includes("safety") ||
        error.message?.includes("moderation")) {
      return {
        success: false,
        error: new SensorPipelineError(
          `Provider refused request: ${error.message}`,
          "PROVIDER_REFUSED",
          422,
          false
        ),
      };
    }

    // Generic provider error
    return {
      success: false,
      error: new SensorPipelineError(
        `Unexpected error: ${error.message}`,
        "INTERNAL_ERROR",
        500,
        false
      ),
    };
  }
}

/**
 * Per-model result envelope - preserves model identity for each outcome
 */
export interface ModelResult {
  model_id: string;
  success: boolean;
  observation?: LlmObservation;
  error?: {
    code: SensorErrorCode;
    message: string;
    status: number;
    retryable: boolean;
  };
}

/**
 * Disagreement descriptor - non-authoritative description of differences
 * NEVER contains ranking, resolution, or "correct" language
 */
export interface DisagreementDescriptor {
  detected: boolean;
  models_compared: number;
  models_succeeded: number;
  models_failed: number;
  description: string; // Non-authoritative phrasing only
}

/**
 * Multi-model pipeline result with full envelope
 */
export interface MultiModelPipelineResult {
  success: boolean;
  kill_switch_engaged: boolean;
  model_results: ModelResult[];
  observations: LlmObservation[];
  errors: Array<{ model_id: string; code: SensorErrorCode; message: string; status: number; retryable: boolean }>;
  disagreement: DisagreementDescriptor;
}

/**
 * Generate non-authoritative disagreement description
 * CRITICAL: No ranking, no "correct", no resolution
 */
function describeDisagreement(
  modelResults: ModelResult[],
  observations: LlmObservation[]
): DisagreementDescriptor {
  const succeeded = modelResults.filter(r => r.success).length;
  const failed = modelResults.filter(r => !r.success).length;
  const total = modelResults.length;
  
  // Check if content differs among successful observations
  const contents = observations.map(o => o.content);
  const uniqueContents = new Set(contents);
  const detected = uniqueContents.size > 1;
  
  let description: string;
  
  if (failed === total) {
    description = "No observations were produced; all models encountered errors.";
  } else if (succeeded === 1) {
    description = "Only one model produced an observation; comparison not possible.";
  } else if (!detected) {
    description = `${succeeded} models produced similar observations.`;
  } else {
    // Non-authoritative description - just states that differences exist
    // AVOID forbidden words: correct, accurate, truth, verified, right, wrong
    const modelNames = observations.map(o => o.model_id);
    description = `${succeeded} models produced different observations. ` +
      `Models compared: ${modelNames.join(", ")}. ` +
      `This difference is presented without reconciliation - no model is designated as authoritative.`;
  }
  
  return {
    detected,
    models_compared: total,
    models_succeeded: succeeded,
    models_failed: failed,
    description,
  };
}

/**
 * Execute multi-model pipeline for disagreement analysis
 * 
 * CRITICAL: Disagreement is DISPLAYED without reconciliation
 * We show that models differ, we do NOT decide which is correct
 */
export async function runMultiModelPipeline(
  input: Omit<SensorPipelineInput, "modelId"> & { modelIds: ModelId[] },
  killSwitchEngaged: boolean
): Promise<MultiModelPipelineResult> {
  if (killSwitchEngaged) {
    const killSwitchError = {
      code: "KILL_SWITCH_ENGAGED" as SensorErrorCode,
      message: "Kill switch engaged - observations permanently disabled for this receipt",
      status: 403,
      retryable: false,
    };
    
    return {
      success: false,
      kill_switch_engaged: true,
      model_results: input.modelIds.map(model_id => ({
        model_id,
        success: false,
        error: killSwitchError,
      })),
      observations: [],
      errors: input.modelIds.map(model_id => ({ model_id, ...killSwitchError })),
      disagreement: {
        detected: false,
        models_compared: input.modelIds.length,
        models_succeeded: 0,
        models_failed: input.modelIds.length,
        description: "Kill switch is engaged; no observations can be generated for this receipt.",
      },
    };
  }

  // Run all models in parallel
  const resultsWithIds = await Promise.all(
    input.modelIds.map(async (modelId) => {
      const result = await runSensorPipeline({ ...input, modelId }, killSwitchEngaged);
      return { modelId, result };
    })
  );

  // Build per-model result envelopes
  const modelResults: ModelResult[] = resultsWithIds.map(({ modelId, result }) => {
    if (result.success) {
      return {
        model_id: modelId,
        success: true,
        observation: result.observation,
      };
    } else {
      return {
        model_id: modelId,
        success: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
          retryable: result.error.retryable,
        },
      };
    }
  });

  // Collect successful observations
  const observations = modelResults
    .filter((r): r is ModelResult & { observation: LlmObservation } => r.success && !!r.observation)
    .map(r => r.observation);

  // Collect errors with model_id
  const errors = modelResults
    .filter((r): r is ModelResult & { error: NonNullable<ModelResult["error"]> } => !r.success && !!r.error)
    .map(r => ({
      model_id: r.model_id,
      code: r.error.code,
      message: r.error.message,
      status: r.error.status,
      retryable: r.error.retryable,
    }));

  // Generate disagreement descriptor (non-authoritative)
  const disagreement = describeDisagreement(modelResults, observations);

  return {
    success: observations.length > 0,
    kill_switch_engaged: false,
    model_results: modelResults,
    observations,
    errors,
    disagreement,
  };
}

export { AdapterError };
