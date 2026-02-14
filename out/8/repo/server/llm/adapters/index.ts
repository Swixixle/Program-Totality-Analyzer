/**
 * LLM Sensor Adapter Registry
 * 
 * Single dispatch point for all LLM observation requests.
 * Validates model_id format and routes to appropriate adapter.
 */

import { 
  LlmSensorAdapter, 
  ProviderName, 
  PROVIDER_ALLOWLIST, 
  MODEL_ID_REGEX,
  AdapterError 
} from "./types";

import { MockAdapter } from "./mock";
import { OpenAIAdapter } from "./openai";
import { AnthropicAdapter } from "./anthropic";
import { GoogleAdapter } from "./google";
import { XaiAdapter } from "./xai";
import { MetaAdapter } from "./meta";
import { MistralAdapter } from "./mistral";
import { CohereAdapter } from "./cohere";
import { PerplexityAdapter } from "./perplexity";
import { DeepseekAdapter } from "./deepseek";
import { QwenAdapter } from "./qwen";

// Factory functions for adapters - mock adapter receives modelId for divergent output support
type AdapterFactory = (modelId?: string) => LlmSensorAdapter;

const adapterRegistryEntries: Array<[ProviderName, AdapterFactory]> = [
  ["mock", (modelId?: string) => new MockAdapter(modelId)],
  ["openai", () => new OpenAIAdapter()],
  ["anthropic", () => new AnthropicAdapter()],
  ["google", () => new GoogleAdapter()],
  ["xai", () => new XaiAdapter()],
  ["meta", () => new MetaAdapter()],
  ["mistral", () => new MistralAdapter()],
  ["cohere", () => new CohereAdapter()],
  ["perplexity", () => new PerplexityAdapter()],
  ["deepseek", () => new DeepseekAdapter()],
  ["qwen", () => new QwenAdapter()],
];

const adapterRegistry: Map<ProviderName, AdapterFactory> = new Map(adapterRegistryEntries);

export function validateModelId(modelId: string): { provider: ProviderName; model: string } {
  if (!MODEL_ID_REGEX.test(modelId)) {
    throw new AdapterError(
      `Invalid model_id format: "${modelId}". Expected format: provider:model (e.g., openai:gpt-4o)`,
      "INVALID_MODEL_ID",
      400
    );
  }

  const [provider, model] = modelId.split(":");
  
  if (!PROVIDER_ALLOWLIST.includes(provider as ProviderName)) {
    throw new AdapterError(
      `Unsupported provider: "${provider}". Allowed providers: ${PROVIDER_ALLOWLIST.join(", ")}`,
      "UNSUPPORTED_PROVIDER",
      400
    );
  }

  return { provider: provider as ProviderName, model };
}

export function getAdapter(provider: ProviderName): LlmSensorAdapter {
  const adapterFactory = adapterRegistry.get(provider);
  
  if (!adapterFactory) {
    throw new AdapterError(
      `No adapter registered for provider: ${provider}`,
      "UNSUPPORTED_PROVIDER",
      400
    );
  }

  return adapterFactory();
}

export function getAdapterForModelId(modelId: string): { 
  adapter: LlmSensorAdapter; 
  provider: ProviderName; 
  model: string;
} {
  const { provider, model } = validateModelId(modelId);
  // Pass full modelId to factory for adapters that need it (e.g., mock for divergent output)
  const adapterFactory = adapterRegistry.get(provider);
  if (!adapterFactory) {
    throw new AdapterError(
      `No adapter registered for provider: ${provider}`,
      "UNSUPPORTED_PROVIDER",
      400
    );
  }
  const adapter = adapterFactory(modelId);
  return { adapter, provider, model };
}

export function checkSensorEnabled(modelId: string): void {
  const enabledSensors = process.env.ENABLED_SENSORS?.split(",").map(s => s.trim()) || [];
  
  if (enabledSensors.length === 0) {
    return;
  }
  
  const { provider, model } = validateModelId(modelId);
  const fullId = `${provider}:${model}`;
  const wildcardId = `${provider}:*`;
  
  if (!enabledSensors.includes(fullId) && !enabledSensors.includes(wildcardId)) {
    throw new AdapterError(
      `Sensor not enabled: ${modelId}. Enable via ENABLED_SENSORS environment variable.`,
      "SENSOR_DISABLED",
      403
    );
  }
}

export { AdapterError } from "./types";
export type { LlmSensorAdapter, AdapterObservation, AdapterRequest } from "./types";
