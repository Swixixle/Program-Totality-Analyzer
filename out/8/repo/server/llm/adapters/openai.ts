/**
 * OpenAI Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if OPENAI_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class OpenAIAdapter extends BaseStubAdapter {
  readonly providerName = "OpenAI";
  readonly envKeyName = "OPENAI_API_KEY";
  readonly envBaseUrlName = "OPENAI_BASE_URL";
}
