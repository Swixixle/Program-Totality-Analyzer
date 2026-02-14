import type { AdapterOptions } from "./adapters/types";
import type { ObservationType } from "@shared/llm-observation-schema";

export function internalToWireObservationType(observationType: ObservationType): string {
  return observationType;
}

const VALID_OBSERVATION_TYPES: readonly ObservationType[] = [
  "paraphrase", "ambiguity", "disagreement", "tone", "structure", "hedging", "refusal_pattern",
] as const;

export function wireToInternalObservationType(wireValue: string): ObservationType {
  if (!VALID_OBSERVATION_TYPES.includes(wireValue as ObservationType)) {
    throw new Error(`Invalid observation_type at wire boundary: "${wireValue}". Valid: ${VALID_OBSERVATION_TYPES.join(", ")}`);
  }
  return wireValue as ObservationType;
}

export function buildAdapterOptions(observationType: ObservationType): AdapterOptions {
  return { observation_type: internalToWireObservationType(observationType) };
}

export const WIRE_FIELD = "observation_type" as const;
export const INTERNAL_FIELD = "observationType" as const;
