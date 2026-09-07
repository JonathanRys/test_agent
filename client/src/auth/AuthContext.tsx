import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  birthdate: string | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const refreshStorageKey = "hiking-agent-refresh-token";

async function parseError(response: Response): Promise<Error> {
  const data = await response.json().catch(() => ({}));
  return new Error(data.error ?? "Request failed");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(() =>
    Boolean(sessionStorage.getItem(refreshStorageKey)),
  );

  async function applyTokens(response: Response): Promise<string> {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Authentication failed");
    setAccessToken(data.accessToken);
    sessionStorage.setItem(refreshStorageKey, data.refreshToken);
    setUser(data.user);
    return data.accessToken;
  }

  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = sessionStorage.getItem(refreshStorageKey);
    if (!refreshToken) return null;

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      sessionStorage.removeItem(refreshStorageKey);
      setAccessToken(null);
      setUser(null);
      return null;
    }
    return applyTokens(response);
  }

  useEffect(() => {
    if (!sessionStorage.getItem(refreshStorageKey)) return;
    refreshAccessToken().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<void> {
    await applyTokens(
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    await applyTokens(
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      }),
    );
  }

  async function logout(): Promise<void> {
    if (accessToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
    setAccessToken(null);
    setUser(null);
    sessionStorage.removeItem(refreshStorageKey);
  }

  async function apiFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    let response = await fetch(input, { ...init, headers });
    const refreshedToken =
      response.status === 401 ? await refreshAccessToken() : null;
    if (!refreshedToken) return response;

    headers.set("Authorization", `Bearer ${refreshedToken}`);
    response = await fetch(input, { ...init, headers });
    return response;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, accessToken, login, register, logout, apiFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export { parseError };
