import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_KEY_STORAGE_KEY = "lantern_api_key";

interface AuthContextValue {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  apiKey: null,
  setApiKey: () => {},
  isAuthenticated: false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  });

  const setApiKey = (key: string | null) => {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  };

  const logout = () => {
    setApiKey(null);
  };

  return (
    <AuthContext.Provider value={{ apiKey, setApiKey, isAuthenticated: !!apiKey, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function apiClient<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(path, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = text;
      try {
        const json = JSON.parse(text);
        errorMsg = json.message || json.error || text;
      } catch {}
      return { ok: false, error: errorMsg, status: response.status };
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return { ok: true, data };
    }
    
    const data = await response.text();
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: String(err), status: 0 };
  }
}

export async function apiGet<T = unknown>(path: string) {
  return apiClient<T>(path, { method: "GET" });
}

export async function apiPost<T = unknown>(path: string, body?: unknown) {
  return apiClient<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T = unknown>(path: string) {
  return apiClient<T>(path, { method: "DELETE" });
}
