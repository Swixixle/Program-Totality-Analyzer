/**
 * Qwen Adapter (Stub)
 * 
 * Returns 501 NOT_IMPLEMENTED if QWEN_API_KEY not configured.
 */

import { BaseStubAdapter } from "./base-stub";

export class QwenAdapter extends BaseStubAdapter {
  readonly providerName = "Qwen";
  readonly envKeyName = "QWEN_API_KEY";
  readonly envBaseUrlName = "QWEN_BASE_URL";
}
