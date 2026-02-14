/**
 * xAI (Grok) Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if XAI_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class XaiAdapter extends BaseStubAdapter {
  readonly providerName = "xAI";
  readonly envKeyName = "XAI_API_KEY";
  readonly envBaseUrlName = "XAI_BASE_URL";
}
