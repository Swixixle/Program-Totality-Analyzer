/**
 * Cohere Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if COHERE_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class CohereAdapter extends BaseStubAdapter {
  readonly providerName = "Cohere";
  readonly envKeyName = "COHERE_API_KEY";
  readonly envBaseUrlName = "COHERE_BASE_URL";
}
