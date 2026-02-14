/**
 * Mock Sensor Adapter
 * 
 * Provides deterministic mock responses for testing.
 * Always available, no configuration required.
 */

import { LlmSensorAdapter, AdapterOptions, AdapterRequest, AdapterObservation } from "./types";

export class MockAdapter implements LlmSensorAdapter {
  private modelId: string;

  constructor(modelId: string = "mock:mock-sensor") {
    this.modelId = modelId;
  }

  buildRequest(
    transcript: { messages: { role: string; content: string }[] },
    opts?: AdapterOptions
  ): AdapterRequest {
    return {
      provider: "mock",
      model: this.modelId.split(":")[1] || "mock-sensor",
      messages: transcript.messages,
      max_tokens: opts?.max_tokens || 500,
      temperature: opts?.temperature || 0.7,
    };
  }

  async execute(request: AdapterRequest): Promise<AdapterObservation> {
    return this.parseResponse({ observation_type: "paraphrase", model_id: this.modelId });
  }

  parseResponse(raw: any): AdapterObservation {
    const observationType = raw?.observation_type || "paraphrase";
    const modelId = raw?.model_id || this.modelId || "mock:mock-sensor";
    
    // Different mock models produce different content for divergent output testing
    const isSecondaryModel = modelId.includes("mock-sensor-2") || modelId.includes("mock-sensor-divergent");
    
    const mockContent: Record<string, string> = isSecondaryModel ? {
      // Secondary model uses different phrasing (for disagreement testing)
      paraphrase: "This exchange may represent an inquiry-response pattern where questions seem to prompt answers.",
      ambiguity: "Certain portions could potentially be interpreted in multiple ways depending on context.",
      disagreement: "Observers might perceive different aspects. Focus could vary between content and form.",
      tone: "The phrasing appears to contain varying levels of certainty. Some expressions seem more definitive.",
      structure: "The dialogue seems to exhibit alternating contributions. Responses appear to follow queries.",
      hedging: "Language that may indicate qualification appears present. Phrases could suggest caution.",
      refusal_pattern: "The pattern seems to show engagement with qualifications. Directness may vary.",
    } : {
      // Primary model content
      paraphrase: "The conversation appears to involve a discussion where one party may be seeking information and another party seems to be providing responses.",
      ambiguity: "Several areas may contain multiple interpretations. The intent behind certain phrases could be understood in different ways.",
      disagreement: "Different observers might note varying aspects. One interpretation could emphasize the informational content, while another might focus on conversational dynamics.",
      tone: "The language appears to employ a mix of markers. Some phrases seem to indicate confidence, while others may suggest hedging.",
      structure: "The conversation appears to follow a turn-taking pattern. Questions seem to precede responses in most cases.",
      hedging: "Observable hedging patterns may include phrases that appear to soften assertions and language that seems to indicate uncertainty.",
      refusal_pattern: "The responses appear to demonstrate a pattern that could be characterized as engaged. Some answers seem more direct while others may include qualifying language.",
    };

    return {
      schema: "llm-observation/1.0",
      model_id: modelId,
      disclaimers: [
        "This is a mock observation for testing purposes.",
        "No actual LLM was consulted.",
      ],
      limitations: [
        "Model may miss context",
        "Model does not assess truth or accuracy",
        "Observation is language-pattern based, not fact-based",
        "Multiple valid interpretations may exist",
      ],
      confidence: {
        level: "medium",
        rationale: "Mock response - confidence is predetermined for testing.",
      },
      observations: mockContent[observationType] || mockContent.paraphrase,
    };
  }
}
