"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setUnauthorizedHandler } from "./api";
import { decodeJwtPayload } from "./jwt";
import { wakeServer } from "./server-wake";
import {
  clearSession,
  getServerSession,
  getStoredSession,
  parseSession,
  storeSession,
  subscribeToSession,
} from "./session-store";

type Caregiver = {
  id: string;
  familyId: string;
  email: string;
  isProvider: boolean;
};

type AuthState = {
  token: string | null;
  caregiver: Caregiver | null;
  /** False until the stored session (if any) has been read on the client.
   * Wait for it before treating "no token" as "signed out". */
  ready: boolean;
  /** True after the server rejected our token (expired/invalid) and we signed
   * out, until the next login -- so the login page can say why. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Pass inviteCode to join an existing family instead of starting a new one. */
  register: (name: string, email: string, password: string, inviteCode?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const subscribeNever = () => () => {};

// The session lives in sessionStorage (see lib/session-store.ts), so a page
// refresh keeps you logged in. Auth state is derived from it rather than
// copied into React state.
export function AuthProvider({ children }: { children: ReactNode }) {
  // false on the server and during hydration, true afterwards -- the
  // standard way to know the stored session has actually been read.
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  const raw = useSyncExternalStore(subscribeToSession, getStoredSession, getServerSession);
  const [sessionExpired, setSessionExpired] = useState(false);

  const session = useMemo(() => parseSession(raw), [raw]);

  const caregiver = useMemo<Caregiver | null>(() => {
    if (!session) return null;
    const payload = decodeJwtPayload(session.token);
    if (!payload) return null;
    return {
      id: payload.sub,
      familyId: payload.family_id,
      email: session.email,
      isProvider: payload.is_provider,
    };
  }, [session]);
  const token = caregiver ? session!.token : null;

  // Start waking the free-tier API as soon as any page opens.
  useEffect(() => {
    void wakeServer();
  }, []);

  // Any API call that comes back 401 while holding a token means the session
  // is over: sign out cleanly (pages then redirect to /login). Only if that
  // token is still the current one -- a late 401 from an earlier session
  // must not sign out whoever logged in since.
  useEffect(() => {
    setUnauthorizedHandler((failedToken) => {
      if (parseSession(getStoredSession())?.token === failedToken) {
        clearSession();
        setSessionExpired(true);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const applyToken = useCallback((newToken: string, email: string) => {
    if (!decodeJwtPayload(newToken)) throw new Error("Received an invalid token from the server");
    storeSession({ token: newToken, email });
    setSessionExpired(false);
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
    async (name: string, email: string, password: string, inviteCode?: string) => {
      await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, invite_code: inviteCode }),
      });
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    clearSession();
    setSessionExpired(false);
  }, []);

  const value = useMemo(
    () => ({ token, caregiver, ready, sessionExpired, login, register, logout }),
    [token, caregiver, ready, sessionExpired, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** For pages that require a logged-in caregiver: redirects to /login when
 * there's no session -- but only once the stored session has been read, so
 * a refresh doesn't bounce a logged-in user to /login first. */
export function useRequireAuth() {
  const { token, caregiver, ready, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  return { token, caregiver, logout };
}
