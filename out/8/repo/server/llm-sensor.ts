/**
 * LLM Sensor Service (P6)
 * 
 * CRITICAL DESIGN PRINCIPLE:
 * LLMs are SENSORS, not ARBITERS.
 * They observe and describe, but NEVER decide truth, validity, or correctness.
 * 
 * DATA ISOLATION:
 * - LLMs do NOT see: hash results, signature status, chain status, verification outcome
 * - LLMs do NOT write to: verification_status, research dataset, forensic facts
 * - LLMs ONLY operate on: transcript (subject to TRANSCRIPT_MODE)
 * - LLMs ONLY write to: llm_observations[] (separate structure)
 */

import { randomUUID } from "crypto";
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
} from "@shared/llm-observation-schema";

/**
 * Transcript input for LLM observation
 * ISOLATED: Does not include any verification data
 */
export interface TranscriptInput {
  messages: Array<{ role: string; content: string }>;
  basis: ObservationBasis;
}

/**
 * Generate observation prompt based on type
 * These prompts are carefully designed to elicit DESCRIPTIVE, not EVALUATIVE output
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
 * Mock LLM response generator for testing
 * Generates compliant observations without actual LLM call
 */
function generateMockObservation(type: ObservationType, transcript: string): string {
  const mockResponses: Record<ObservationType, string> = {
    paraphrase: "The conversation appears to involve a discussion where one party may be seeking information and another party seems to be providing responses. The exchange could be interpreted as covering topics that the participants appear to consider relevant to their interaction.",
    
    ambiguity: "Several areas may contain multiple interpretations: (1) The intent behind certain phrases could be understood in different ways. (2) Some references appear ambiguous and might point to different concepts. (3) The context seems to allow for varying readings of the exchange.",
    
    disagreement: "Different observers might note varying aspects: One interpretation could emphasize the informational content, while another might focus on the conversational dynamics. The responses appear to contain elements that could be read as either comprehensive or selective.",
    
    tone: "The language appears to employ a mix of markers: Some phrases seem to indicate confidence, while others may suggest hedging. The overall tone could be characterized as conversational, though different readers might perceive varying levels of formality.",
    
    structure: "The conversation appears to follow a turn-taking pattern. Questions seem to precede responses in most cases. The structure could be described as relatively standard for this type of exchange.",
    
    hedging: "Observable hedging patterns may include: phrases that appear to soften assertions, language that seems to indicate uncertainty, and formulations that could be interpreted as allowing for alternative viewpoints.",
    
    refusal_pattern: "The responses appear to demonstrate a pattern that could be characterized as engaged. Some answers seem more direct while others may include qualifying language. The overall approach appears consistent with typical conversational norms.",
  };

  return mockResponses[type];
}

/**
 * Call actual LLM API (placeholder for real implementation)
 * In production, this would call OpenAI/Anthropic/etc.
 */
async function callLlmApi(
  modelId: ModelId,
  prompt: string
): Promise<string> {
  // For mock-sensor model, return mock response
  if (modelId === "mock-sensor") {
    // Extract type from prompt (simple heuristic)
    const typeMatch = prompt.match(/Task: (Restate|Identify|Note|Describe)/);
    const type: ObservationType = typeMatch?.[1] === "Restate" ? "paraphrase" :
                                  typeMatch?.[1] === "Identify" ? "ambiguity" :
                                  typeMatch?.[1] === "Note" ? "disagreement" : "tone";
    return generateMockObservation(type, "");
  }

  // TODO: Implement actual LLM API calls
  // For now, throw error for non-mock models
  throw new Error(`LLM API not yet implemented for model: ${modelId}. Use mock-sensor for testing.`);
}

/**
 * Strictly enforce language hygiene on LLM output
 * REJECTS outputs with forbidden words - does not attempt to sanitize
 */
function enforceLanguageHygiene(content: string): { 
  valid: boolean; 
  violations: string[]; 
  hedgingPresent: boolean;
} {
  const violations = validateLanguageHygiene(content);
  const hedgingPresent = hasAppropriateHedging(content);
  
  if (violations.length > 0) {
    console.warn("[LLM-Sensor] REJECTED: Forbidden language detected:", violations);
    return { valid: false, violations, hedgingPresent };
  }
  
  if (!hedgingPresent) {
    console.warn("[LLM-Sensor] WARNING: Output lacks required hedging language");
  }
  
  return { valid: true, violations: [], hedgingPresent };
}

/**
 * Transform output to add hedging if missing
 * Only used when hedging is absent but no forbidden words present
 */
function addHedgingPrefix(content: string): string {
  return `This observation may be interpreted in multiple ways. ${content}`;
}

/**
 * Generate an LLM observation for a transcript
 * 
 * CRITICAL: This function is DATA-ISOLATED
 * It receives ONLY the transcript, not any verification data
 */
export async function generateObservation(
  receiptId: string,
  transcriptInput: TranscriptInput,
  observationType: ObservationType,
  modelId: ModelId = "mock-sensor"
): Promise<LlmObservation> {
  // Format transcript for LLM input
  const transcriptText = transcriptInput.messages
    .map(m => `[${m.role}]: ${m.content}`)
    .join("\n\n");

  // Generate prompt
  const prompt = getObservationPrompt(observationType, transcriptText);

  // Call LLM
  const rawOutput = await callLlmApi(modelId, prompt);

  // STRICT language hygiene enforcement
  const hygiene = enforceLanguageHygiene(rawOutput);
  
  if (!hygiene.valid) {
    // REJECT output with forbidden words - throw error
    throw new Error(
      `LLM output rejected due to forbidden language: ${hygiene.violations.join(", ")}. ` +
      `Sensor-mode requires neutral, observational language only.`
    );
  }

  // Add hedging prefix if missing (required for compliance)
  let finalContent = rawOutput;
  if (!hygiene.hedgingPresent) {
    finalContent = addHedgingPrefix(rawOutput);
    console.log("[LLM-Sensor] Added hedging prefix to output lacking hedge words");
  }

  // Build observation with MANDATORY fields from schema constants
  const observation: LlmObservation = {
    schema: LLM_OBSERVATION_SCHEMA_VERSION,
    observation_id: randomUUID(),
    receipt_id: receiptId,
    model_id: modelId,
    observation_type: observationType,
    based_on: transcriptInput.basis,
    content: finalContent,
    confidence_statement: CONFIDENCE_STATEMENT, // MANDATORY constant
    limitations: [...STANDARD_LIMITATIONS],    // MANDATORY array
    created_at: new Date().toISOString(),
  };

  return observation;
}

/**
 * Generate observations from multiple models for disagreement analysis
 * 
 * CRITICAL: This displays disagreement WITHOUT reconciliation
 * We show that models differ, we do NOT decide which is correct
 */
export async function generateMultiModelObservations(
  receiptId: string,
  transcriptInput: TranscriptInput,
  observationType: ObservationType,
  modelIds: ModelId[]
): Promise<LlmObservation[]> {
  const observations = await Promise.all(
    modelIds.map(modelId =>
      generateObservation(receiptId, transcriptInput, observationType, modelId)
    )
  );

  return observations;
}

/**
 * Format transcript for observation input
 * This extracts ONLY the transcript, deliberately excluding all verification data
 */
export function prepareTranscriptInput(
  messages: Array<{ role: string; content: string }>,
  verificationStatus: string
): TranscriptInput {
  // Determine basis based on verification (but LLM doesn't see this)
  const basis: ObservationBasis = 
    verificationStatus === "VERIFIED" || verificationStatus === "PARTIALLY_VERIFIED"
      ? "verified_transcript"
      : "submitted_transcript";

  return {
    messages,
    basis,
  };
}
