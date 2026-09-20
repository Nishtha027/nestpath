"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError, WS_URL } from "@/lib/api";
import type { CareLog } from "@/lib/types";

const CARE_LOG_TYPES: CareLog["type"][] = ["feed", "diaper", "sleep", "medication"];

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
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const [type, setType] = useState<CareLog["type"]>("feed");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/families/${familyId}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      setConnected(true);
      setWsError(null);
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setWsError("Live connection failed");
    ws.onmessage = (event) => {
      try {
        const entry: CareLog = JSON.parse(event.data);
        if (entry.child_id === childId) {
          setEntries((prev) => [entry, ...prev]);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, [childId, familyId, token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/children/${childId}/care-logs`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, notes: notes || null }),
      });
      // Not added to state here -- the WebSocket broadcast (this tab is
      // connected to it too) is what updates the list, so a single code
      // path handles both "my own entry" and "someone else's entry".
      setNotes("");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to add entry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        Live connection: {connected ? "connected" : "disconnected"}
        {wsError && <span className="text-red-600"> -- {wsError}</span>}
      </p>

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
        <p className="text-sm text-zinc-500">No entries yet in this session.</p>
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
