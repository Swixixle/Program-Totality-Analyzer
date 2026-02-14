let _warnedMissingKey = false;

export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});

  const env = (import.meta as any).env || {};
  const mode = env.MODE;
  const isDevLike = Boolean(env.DEV) || mode === "test" || mode === "e2e";

  const url = typeof input === "string" ? input : input.toString();
  const isPrivateApi = url.startsWith("/api/") && !url.startsWith("/api/public/");

  if (isDevLike && isPrivateApi) {
    const devKey = env.VITE_DEV_API_KEY;
    if (devKey && !headers.has("x-api-key")) {
      headers.set("x-api-key", devKey);
    } else if (!devKey) {
      if (mode === "e2e") {
        throw new Error("Missing VITE_DEV_API_KEY (required for E2E private API calls)");
      }
      if (!_warnedMissingKey) {
        _warnedMissingKey = true;
        console.warn(
          "Missing VITE_DEV_API_KEY. Set it in Replit Secrets (dev/test) to access private endpoints."
        );
      }
    }
  }

  return fetch(input, { ...init, headers });
}
