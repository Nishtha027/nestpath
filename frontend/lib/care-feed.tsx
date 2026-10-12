"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, WS_URL } from "./api";
import { reconnectDelayMs } from "./backoff";
import { loadErrorMessage, withRetry } from "./retry";
import {
  applyEvent,
  applyEventToLatest,
  mergeEntries,
  normalizeEntry,
  parseCareMessage,
  type CareEvent,
} from "./tracker";
import type { CareLog, CareLogLatest, CareLogType } from "./types";

// The family's live care-log feed: one WebSocket for the whole logged-in
// app (opened by the app shell), shared by Home, Log and History. Each page
// loads what it shows over HTTP and then applies the pushed changes; after
// every reconnect it loads again, since the feed only pushes changes made
// while connected.

// WebSocket close code the server uses when it rejects our token. Unlike a
// dropped connection, retrying can't help: the token stays bad.
const CLOSE_POLICY_VIOLATION = 1008;

export type FeedStatus = "connecting" | "connected" | "reconnecting" | "rejected";

type Listener = (event: CareEvent) => void;

type CareFeed = {
  status: FeedStatus;
  /** Goes up by one on every (re)connect: the moment to catch up. */
  connection: number;
  subscribe: (listener: Listener) => () => void;
};

const CareFeedContext = createContext<CareFeed | null>(null);

export function CareFeedProvider({ familyId, token, children }: { familyId: string; token: string; children: ReactNode }) {
  const [status, setStatus] = useState<FeedStatus>("connecting");
  const [connection, setConnection] = useState(0);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0; // consecutive failed attempts since the last successful connect
    // Set by cleanup. React StrictMode runs effects twice in dev, and
    // cleanup also runs on unmount: after it, no handler may touch state
    // or schedule another retry.
    let disposed = false;

    function connect() {
      const ws = new WebSocket(`${WS_URL}/ws/families/${familyId}?token=${encodeURIComponent(token)}`);
      socket = ws;
      ws.onopen = () => {
        if (disposed) return;
        failures = 0;
        setStatus("connected");
        setConnection((n) => n + 1);
      };
      ws.onmessage = (message) => {
        if (disposed) return;
        const event = parseCareMessage(String(message.data));
        if (event) listeners.current.forEach((listener) => listener(event));
      };
      // An error is always followed by a close; onclose does the handling.
      ws.onclose = (event) => {
        if (disposed) return;
        if (event.code === CLOSE_POLICY_VIOLATION) {
          setStatus("rejected");
          return;
        }
        setStatus("reconnecting");
        retryTimer = setTimeout(connect, reconnectDelayMs(failures));
        failures += 1;
      };
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, [familyId, token]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ status, connection, subscribe }), [status, connection, subscribe]);
  return <CareFeedContext.Provider value={value}>{children}</CareFeedContext.Provider>;
}

export function useCareFeed(): CareFeed {
  const feed = useContext(CareFeedContext);
  if (!feed) throw new Error("useCareFeed must be used inside the logged-in app shell");
  return feed;
}

/** Calls `onEvent` for every live change, and `onReconnect` after the feed
 * comes back from a drop (not on the first connect). */
function useFeedHandlers(onEvent: Listener, onReconnect: () => void) {
  const { subscribe, connection } = useCareFeed();
  const handlers = useRef({ onEvent, onReconnect });
  useEffect(() => {
    handlers.current = { onEvent, onReconnect };
  });
  useEffect(() => subscribe((event) => handlers.current.onEvent(event)), [subscribe]);
  const firstConnection = useRef<number | null>(null);
  useEffect(() => {
    if (connection === 0) return;
    if (firstConnection.current === null) {
      firstConnection.current = connection;
      return;
    }
    handlers.current.onReconnect();
  }, [connection]);
}

/** The current time, updated every `intervalMs`, for "time since" text. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const PAGE_SIZE = 50;

function listPath(childId: string, type: CareLogType | null, offset: number) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (type) params.set("type", type);
  return `/children/${childId}/care-logs?${params}`;
}

/** A child's entries, newest first (one type, or all), kept live. Mount it
 * with a key per type, so changing the filter starts fresh. */
export function useCareLogList(childId: string, token: string, type: CareLogType | null) {
  const [entries, setEntries] = useState<CareLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  // Entries that arrived live: they slide in with a short highlight.
  const [arrivedIds, setArrivedIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    withRetry(() => apiFetch<CareLog[]>(listPath(childId, type, 0), { token }))
      .then((page) => {
        if (cancelled) return;
        setEntries((prev) => mergeEntries(page.map(normalizeEntry), prev));
        setHasMore(page.length === PAGE_SIZE);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(loadErrorMessage(err, "Couldn't load entries."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [childId, token, type, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await withRetry(() => apiFetch<CareLog[]>(listPath(childId, type, entries.length), { token }));
      setEntries((prev) => mergeEntries(page.map(normalizeEntry), prev));
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setMoreError(loadErrorMessage(err, "Couldn't load more."));
    } finally {
      setLoadingMore(false);
    }
  }, [childId, type, token, entries.length]);

  useFeedHandlers(
    (event) => {
      setEntries((prev) => applyEvent(prev, event, childId, type));
      if (event.kind === "upsert" && event.entry.child_id === childId) {
        setArrivedIds((prev) => new Set(prev).add(event.entry.id));
      }
    },
    () => setAttempt((n) => n + 1)
  );

  /** Our own change, applied at once (the socket may be down right now;
   * its echo is deduped by id). */
  const applyLocal = useCallback(
    (event: CareEvent) => setEntries((prev) => applyEvent(prev, event, childId, type)),
    [childId, type]
  );

  return { entries, loading, error, retry, hasMore, loadMore, loadingMore, moreError, arrivedIds, applyLocal };
}

/** The newest feed, sleep, diaper and medication entry of a child, kept
 * live (for the Home tiles and the sleep timer). */
export function useLatestCareLogs(childId: string, token: string) {
  const [latest, setLatest] = useState<CareLogLatest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    withRetry(() => apiFetch<CareLogLatest>(`/children/${childId}/care-logs/latest`, { token }))
      .then((loaded) => {
        if (cancelled) return;
        const normalized = Object.fromEntries(
          Object.entries(loaded).map(([key, value]) => [key, value ? normalizeEntry(value) : null])
        ) as CareLogLatest;
        setLatest(normalized);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(loadErrorMessage(err, "Couldn't load the latest entries."));
      });
    return () => {
      cancelled = true;
    };
  }, [childId, token, attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const retry = useCallback(() => {
    setError(null);
    setLatest(null);
    setAttempt((n) => n + 1);
  }, []);

  /** Applies a change (live, or our own save); asks the server again when
   * the answer can't be worked out locally. */
  const latestRef = useRef(latest);
  useEffect(() => {
    latestRef.current = latest;
  });
  const apply = useCallback(
    (event: CareEvent) => {
      const prev = latestRef.current;
      if (!prev) return;
      const next = applyEventToLatest(prev, event, childId);
      if (next === null) {
        refresh();
      } else if (next !== prev) {
        latestRef.current = next;
        setLatest(next);
      }
    },
    [childId, refresh]
  );

  useFeedHandlers(apply, refresh);

  return { latest, loading: latest === null && !error, error, retry, apply };
}
