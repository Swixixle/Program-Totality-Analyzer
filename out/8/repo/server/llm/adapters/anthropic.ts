/**
 * Anthropic Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if ANTHROPIC_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class AnthropicAdapter extends BaseStubAdapter {
  readonly providerName = "Anthropic";
  readonly envKeyName = "ANTHROPIC_API_KEY";
  readonly envBaseUrlName = "ANTHROPIC_BASE_URL";
}
