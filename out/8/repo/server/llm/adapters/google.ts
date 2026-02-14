/**
 * Google Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if GOOGLE_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class GoogleAdapter extends BaseStubAdapter {
  readonly providerName = "Google";
  readonly envKeyName = "GOOGLE_API_KEY";
  readonly envBaseUrlName = "GOOGLE_BASE_URL";
}
