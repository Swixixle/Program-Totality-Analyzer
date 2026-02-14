/**
 * Meta Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if META_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class MetaAdapter extends BaseStubAdapter {
  readonly providerName = "Meta";
  readonly envKeyName = "META_API_KEY";
  readonly envBaseUrlName = "META_BASE_URL";
}
