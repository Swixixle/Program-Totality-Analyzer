/**
 * DeepSeek Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if DEEPSEEK_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class DeepseekAdapter extends BaseStubAdapter {
  readonly providerName = "DeepSeek";
  readonly envKeyName = "DEEPSEEK_API_KEY";
  readonly envBaseUrlName = "DEEPSEEK_BASE_URL";
}
