/**
 * Base Stub Adapter
 * 
 * Provides 501 NOT_IMPLEMENTED for providers without configuration.
 * Ensures honest reporting of unavailable sensors.
 */

import { LlmSensorAdapter, AdapterOptions, AdapterRequest, AdapterObservation, AdapterError } from "./types";

export abstract class BaseStubAdapter implements LlmSensorAdapter {
  abstract readonly providerName: string;
  abstract readonly envKeyName: string;
  abstract readonly envBaseUrlName?: string;

  protected checkConfiguration(): void {
    const apiKey = process.env[this.envKeyName];
    if (!apiKey) {
      throw new AdapterError(
        `${this.providerName} adapter not configured: ${this.envKeyName} environment variable not set`,
        "NOT_IMPLEMENTED",
        501
      );
    }
  }

  buildRequest(
    transcript: { messages: { role: string; content: string }[] },
    opts?: AdapterOptions
  ): AdapterRequest {
    this.checkConfiguration();
    return {
      provider: this.providerName.toLowerCase(),
      model: "default",
      messages: transcript.messages,
      max_tokens: opts?.max_tokens || 500,
      temperature: opts?.temperature || 0.7,
    };
  }

  parseResponse(raw: any): AdapterObservation {
    this.checkConfiguration();
    throw new AdapterError(
      `${this.providerName} adapter not yet implemented`,
      "NOT_IMPLEMENTED",
      501
    );
  }

  async execute(request: AdapterRequest): Promise<AdapterObservation> {
    this.checkConfiguration();
    throw new AdapterError(
      `${this.providerName} adapter not yet implemented`,
      "NOT_IMPLEMENTED",
      501
    );
  }
}
