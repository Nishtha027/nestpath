"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError, WS_URL } from "@/lib/api";
import { reconnectDelayMs } from "@/lib/backoff";
import type { CareLog } from "@/lib/types";

const CARE_LOG_TYPES: CareLog["type"][] = ["feed", "diaper", "sleep", "medication"];

// WebSocket close code the server uses when it rejects our token. Unlike a
// dropped connection, retrying can't help -- the token stays bad.
const CLOSE_POLICY_VIOLATION = 1008;

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "rejected";

/** Union by id, newest first. A catch-up fetch and live pushes can overlap
 * (and our own POST echoes back over the socket), so entries are deduped. */
function mergeEntries(incoming: CareLog[], existing: CareLog[]): CareLog[] {
  const byId = new Map<string, CareLog>();
  for (const entry of [...existing, ...incoming]) byId.set(entry.id, entry);
  return [...byId.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function LiveCareLog({
  childId,
  familyId,
  token,
}: {
  childId: string;
  familyId: string;
  token: string;
}) {
  const [entries, setEntries] = useState<CareLog[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [type, setType] = useState<CareLog["type"]>("feed");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0; // consecutive failed attempts since the last successful connect
    // Set by cleanup. React StrictMode runs effects twice in dev (setup,
    // cleanup, setup), and cleanup also runs on unmount -- after it, no
    // handler may touch state or schedule another retry.
    let disposed = false;

    function loadEntries() {
      apiFetch<CareLog[]>(`/children/${childId}/care-logs`, { token })
        .then((loaded) => {
          if (disposed) return;
          setEntries((prev) => mergeEntries(loaded, prev));
          setLoadError(null);
        })
        .catch((err) => {
          if (disposed) return;
          setLoadError(err instanceof ApiError ? err.message : "Failed to load entries");
        });
    }

    function connect() {
      const ws = new WebSocket(`${WS_URL}/ws/families/${familyId}?token=${encodeURIComponent(token)}`);
      socket = ws;

      ws.onopen = () => {
        if (disposed) return;
        failures = 0; // back to a 1s first retry next time it drops
        setStatus("connected");
        // The feed only pushes entries made while we're connected, so fetch
        // what we missed -- on the first connect and after every reconnect.
        loadEntries();
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const entry: CareLog = JSON.parse(event.data);
          if (entry.child_id === childId) {
            setEntries((prev) => mergeEntries([entry], prev));
          }
        } catch {
          // ignore malformed messages
        }
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
  }, [childId, familyId, token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<CareLog>(`/children/${childId}/care-logs`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, notes: notes || null }),
      });
      // Add it here as well as via the socket's broadcast: if the socket is
      // down right now, the entry would otherwise be missing until the
      // reconnect catch-up. mergeEntries dedupes the echo by id.
      setEntries((prev) => mergeEntries([created], prev));
      setNotes("");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to add entry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500" data-testid="connection-status">
        Live connection:{" "}
        {status === "connected" && "connected"}
        {status === "connecting" && "connecting..."}
        {status === "reconnecting" && "reconnecting..."}
        {status === "rejected" && (
          <span className="text-red-600">stopped -- your session was rejected, please log in again</span>
        )}
      </p>
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CareLog["type"])}
            className="rounded border px-3 py-2"
          >
            {CARE_LOG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Adding..." : "Add entry"}
        </button>
      </form>
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No entries yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded border px-3 py-2 text-sm">
              <span className="font-medium">{entry.type}</span>
              <span className="ml-2 text-zinc-500">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              {entry.notes && (
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{entry.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
