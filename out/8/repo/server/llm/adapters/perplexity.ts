/**
 * Perplexity Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if PERPLEXITY_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class PerplexityAdapter extends BaseStubAdapter {
  readonly providerName = "Perplexity";
  readonly envKeyName = "PERPLEXITY_API_KEY";
  readonly envBaseUrlName = "PERPLEXITY_BASE_URL";
}
