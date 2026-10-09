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
import { apiFetch } from "./api";
import { loadErrorMessage, withRetry } from "./retry";
import type { Child } from "./types";

// Family-wide state for the logged-in app shell: the child list (fetched
// once per shell mount, not once per tab) and which child the child-level
// tabs point at. The selection is remembered in sessionStorage, alongside
// the session itself, so it survives a refresh.

const SELECTED_KEY = "nestpath.selectedChild";

type AppState = {
  token: string;
  childList: Child[];
  childrenLoading: boolean;
  childrenError: string | null;
  /** Try loading the child list again after it failed. */
  retryChildren: () => void;
  addChild: (child: Child) => void;
  /** The selected child if it still exists, else the first child, else null. */
  selectedChild: Child | null;
  selectChild: (childId: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

function readSelected(): string | null {
  try {
    return sessionStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function AppStateProvider({ token, children }: { token: string; children: ReactNode }) {
  const [childList, setChildList] = useState<Child[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(readSelected);
  const [childrenAttempt, setChildrenAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    withRetry(() => apiFetch<Child[]>("/children", { token }))
      .then((list) => {
        if (!cancelled) setChildList(list);
      })
      .catch((err) => {
        if (!cancelled) setChildrenError(loadErrorMessage(err, "Failed to load children"));
      })
      .finally(() => {
        if (!cancelled) setChildrenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, childrenAttempt]);

  const retryChildren = useCallback(() => {
    setChildrenError(null);
    setChildrenLoading(true);
    setChildrenAttempt((n) => n + 1);
  }, []);

  const selectChild = useCallback((childId: string) => {
    setSelectedId(childId);
    try {
      sessionStorage.setItem(SELECTED_KEY, childId);
    } catch {
      // selection just won't survive a refresh
    }
  }, []);

  const addChild = useCallback((child: Child) => {
    setChildList((prev) => [...prev, child]);
  }, []);

  const selectedChild = useMemo(
    () => childList.find((c) => c.id === selectedId) ?? childList[0] ?? null,
    [childList, selectedId]
  );

  const value = useMemo(
    () => ({
      token,
      childList,
      childrenLoading,
      childrenError,
      retryChildren,
      addChild,
      selectedChild,
      selectChild,
    }),
    [token, childList, childrenLoading, childrenError, retryChildren, addChild, selectedChild, selectChild]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside the logged-in app shell");
  return ctx;
}

/** Inside /children/[id]/...: the child that route is about. */
const CurrentChildContext = createContext<Child | null>(null);
export const CurrentChildProvider = CurrentChildContext.Provider;

export function useCurrentChild(): Child {
  const child = useContext(CurrentChildContext);
  if (!child) throw new Error("useCurrentChild must be used inside /children/[id]");
  return child;
}

export function ageLabel(birthDateISO: string, today: Date = new Date()): string {
  const birth = new Date(`${birthDateISO}T00:00:00`);
  const days = Math.floor((today.getTime() - birth.getTime()) / 86_400_000);
  if (days < 0) return "not born yet";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} old`;
  if (days < 61) return `${Math.floor(days / 7)} weeks old`;
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 24) return `${months} months old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} year${years === 1 ? "" : "s"}${rem ? ` ${rem} month${rem === 1 ? "" : "s"}` : ""} old`;
}
