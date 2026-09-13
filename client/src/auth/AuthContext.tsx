import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type User = {
  id: number;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const refreshStorageKey = "hiking-agent-refresh-token";
const lastAgentSessionPrefix = "hiking-agent-last-session:";

export function getLastAgentSession(userId: number): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage?.getItem(`${lastAgentSessionPrefix}${userId}`) ?? null
  );
}

export function setLastAgentSession(userId: number, sessionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage?.setItem(`${lastAgentSessionPrefix}${userId}`, sessionId);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return typeof window.localStorage?.getItem === "function"
    ? window.localStorage.getItem(refreshStorageKey)
    : null;
}

function setStoredRefreshToken(token: string): void {
  if (
    typeof window !== "undefined" &&
    typeof window.localStorage?.setItem === "function"
  ) {
    window.localStorage.setItem(refreshStorageKey, token);
  }
}

function removeStoredRefreshToken(): void {
  if (
    typeof window !== "undefined" &&
    typeof window.localStorage?.removeItem === "function"
  ) {
    window.localStorage.removeItem(refreshStorageKey);
  }
}

async function parseError(response: Response): Promise<Error> {
  const data = await response.json().catch(() => ({}));
  return new Error(data.error ?? "Request failed");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshExpiresAt, setRefreshExpiresAt] = useState<string | null>(null);
  const refreshPromise = useRef<Promise<string | null> | null>(null);
  const [loading, setLoading] = useState(() =>
    Boolean(getStoredRefreshToken()),
  );
  const location = useLocation();
  const navigate = useNavigate();

  function clearSessionAndRedirect(): void {
    removeStoredRefreshToken();
    setAccessToken(null);
    setRefreshExpiresAt(null);
    setUser(null);

    if (location.pathname !== "/login") {
      navigate("/login", {
        replace: true,
        state: {
          from: `${location.pathname}${location.search}`,
          message: "Your session expired. Please log in again.",
        },
      });
    }
  }

  async function applyTokens(
    response: Response,
  ): Promise<{ accessToken: string; user: User }> {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Authentication failed");
    setAccessToken(data.accessToken);
    setRefreshExpiresAt(data.refreshExpiresAt);
    setStoredRefreshToken(data.refreshToken);
    setUser(data.user);
    return { accessToken: data.accessToken, user: data.user };
  }

  async function refreshAccessToken(): Promise<string | null> {
    if (refreshPromise.current) return refreshPromise.current;

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return null;

    const refresh = (async () => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        clearSessionAndRedirect();
        return null;
      }
      const tokens = await applyTokens(response);
      return tokens.accessToken;
    })();

    refreshPromise.current = refresh;
    try {
      return await refresh;
    } finally {
      if (refreshPromise.current === refresh) refreshPromise.current = null;
    }
  }

  useEffect(() => {
    if (!getStoredRefreshToken()) return;
    refreshAccessToken().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!refreshExpiresAt) return;

    const timeout = window.setTimeout(
      clearSessionAndRedirect,
      Math.max(0, new Date(refreshExpiresAt).getTime() - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [location.pathname, location.search, refreshExpiresAt]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === refreshStorageKey && event.newValue === null) {
        setAccessToken(null);
        setRefreshExpiresAt(null);
        setUser(null);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const tokens = await applyTokens(
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );
    return tokens.user;
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<User> {
    const tokens = await applyTokens(
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      }),
    );
    return tokens.user;
  }

  async function logout(): Promise<void> {
    if (accessToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
    setAccessToken(null);
    setRefreshExpiresAt(null);
    setUser(null);
    removeStoredRefreshToken();
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
