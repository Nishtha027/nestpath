"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api";
import { decodeJwtPayload } from "./jwt";

type Caregiver = {
  id: string;
  familyId: string;
  email: string;
};

type AuthState = {
  token: string | null;
  caregiver: Caregiver | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

// In-memory only, on purpose: this is a demo, so the JWT is never written
// to localStorage/cookies -- refreshing the page logs you out.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);

  const applyToken = useCallback((newToken: string, email: string) => {
    const payload = decodeJwtPayload(newToken);
    if (!payload) throw new Error("Received an invalid token from the server");
    setToken(newToken);
    setCaregiver({ id: payload.sub, familyId: payload.family_id, email });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const body = new URLSearchParams({ username: email, password });
      const res = await apiFetch<{ access_token: string; token_type: string }>(
        "/auth/login",
        { method: "POST", body }
      );
      applyToken(res.access_token, email);
    },
    [applyToken]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    setToken(null);
    setCaregiver(null);
  }, []);

  const value = useMemo(
    () => ({ token, caregiver, login, register, logout }),
    [token, caregiver, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** For pages that require a logged-in caregiver: redirects to /login when
 * there's no token (e.g. straight after a page refresh, since the token
 * only lives in memory). */
export function useRequireAuth() {
  const { token, caregiver, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  return { token, caregiver, logout };
}
