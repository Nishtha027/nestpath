"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError, WS_URL } from "@/lib/api";
import { reconnectDelayMs } from "@/lib/backoff";
import type { CareLog } from "@/lib/types";
import { BUTTON_PRIMARY, CARD, FIELD, INPUT, LABEL, LIST_ITEM } from "@/lib/ui";
import { Message } from "../../../ui/Message";
import { EmptyState } from "../../../ui/EmptyState";
import { Bunny } from "../../../ui/illustrations";

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
  // Entries that arrived live (over the socket, or just added here). They
  // slide in with a short highlight; the catch-up fetch's entries don't.
  const [arrivedIds, setArrivedIds] = useState<ReadonlySet<string>>(() => new Set());

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
          setLoadError(err instanceof ApiError ? err.message : "Couldn't load entries. Refresh to try again.");
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
            setArrivedIds((prev) => new Set(prev).add(entry.id));
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
      setArrivedIds((prev) => new Set(prev).add(created.id));
      setNotes("");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p
        className="inline-flex items-center gap-2 self-start rounded-full bg-surface px-3 py-1 text-sm text-muted ring-1 ring-line"
        data-testid="connection-status"
      >
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${
            status === "connected"
              ? "bg-success-ink"
              : status === "rejected"
                ? "bg-danger-ink"
                : "border-2 border-muted"
          }`}
        />
        {status === "connected" && "Live"}
        {status === "connecting" && "Connecting..."}
        {status === "reconnecting" && "Reconnecting..."}
        {status === "rejected" && (
          <span className="font-semibold text-danger-ink">Disconnected. Log in again.</span>
        )}
      </p>
      {loadError && <Message tone="error">{loadError}</Message>}

      <form onSubmit={handleSubmit} className={`${CARD} sm:flex-row sm:flex-wrap sm:items-end`}>
        <div className={FIELD}>
          <label htmlFor="care-log-type" className={LABEL}>Type</label>
          <select
            id="care-log-type"
            value={type}
            onChange={(e) => setType(e.target.value as CareLog["type"])}
            className={`${INPUT} capitalize`}
          >
            {CARE_LOG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="care-log-notes" className={LABEL}>Notes</label>
          <input
            id="care-log-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={INPUT}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className={BUTTON_PRIMARY}
        >
          {submitting ? "Adding..." : "Add"}
        </button>
      </form>
      {submitError && <Message tone="error">{submitError}</Message>}

      {entries.length === 0 ? (
        <EmptyState art={<Bunny animated className="h-20 w-20" />} title="No entries yet">
          Your family sees new entries right away.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className={`text-sm ${LIST_ITEM} ${arrivedIds.has(entry.id) ? "np-arrive" : ""}`}>
              <span className="font-bold capitalize">{entry.type}</span>
              <span className="ml-2 text-muted tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              {entry.notes && <p className="mt-1 text-ink">{entry.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
