/**
 * LLM Sensor Adapter Interface (FROZEN - DO NOT CHANGE)
 * 
 * All adapters must implement this interface.
 * LLMs are SENSORS - they observe transcript only, never verification data.
 */

export interface LlmSensorAdapter {
  buildRequest(
    transcript: { messages: { role: string; content: string }[] },
    opts?: AdapterOptions
  ): AdapterRequest;
  
  parseResponse(raw: any): AdapterObservation;
  
  execute(request: AdapterRequest): Promise<AdapterObservation>;
}

export interface AdapterOptions {
  observation_type?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AdapterRequest {
  provider: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
}

export interface AdapterObservation {
  schema: "llm-observation/1.0";
  model_id: string;
  disclaimers: string[];
  limitations: string[];
  confidence: {
    level: "low" | "medium" | "high";
    rationale: string;
  };
  observations: string;
}

export type ProviderName = 
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "meta"
  | "mistral"
  | "cohere"
  | "perplexity"
  | "deepseek"
  | "qwen"
  | "mock"
  | "other";

export const PROVIDER_ALLOWLIST: ProviderName[] = [
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
];

export const MODEL_ID_REGEX = /^[a-z0-9_-]+:[a-z0-9_.-]+$/;

export class AdapterError extends Error {
  constructor(
    message: string,
    public code: "INVALID_MODEL_ID" | "UNSUPPORTED_PROVIDER" | "NOT_IMPLEMENTED" | "API_ERROR" | "SENSOR_DISABLED",
    public status: number = 400
  ) {
    super(message);
    this.name = "AdapterError";
  }
}
