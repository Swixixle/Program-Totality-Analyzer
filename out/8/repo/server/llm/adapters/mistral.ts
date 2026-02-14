/**
 * Mistral Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if MISTRAL_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class MistralAdapter extends BaseStubAdapter {
  readonly providerName = "Mistral";
  readonly envKeyName = "MISTRAL_API_KEY";
  readonly envBaseUrlName = "MISTRAL_BASE_URL";
}
