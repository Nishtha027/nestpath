"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import type { ScheduleItem } from "@/lib/types";

function doseLabel(item: ScheduleItem) {
  return `${item.vaccine_id.toUpperCase()} dose ${item.dose_number ?? "?"}`;
}

export function VaccineTimeline({ childId, token }: { childId: string; token: string }) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [administeredDate, setAdministeredDate] = useState(todayISO);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  // What the last mark-given did: the dose now recorded as given, plus
  // any follow-up doses the server's catch-up recalculation created.
  const [recalc, setRecalc] = useState<{ given: ScheduleItem; created: ScheduleItem[] } | null>(
    null
  );

  useEffect(() => {
    apiFetch<ScheduleItem[]>(`/children/${childId}/schedule`, { token })
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load schedule"))
      .finally(() => setLoading(false));
  }, [childId, token]);

  async function handleMarkGiven(item: ScheduleItem) {
    setMarkError(null);
    setRecalc(null);
    setMarkingId(item.id);
    try {
      const updated = await apiFetch<ScheduleItem[]>(
        `/children/${childId}/schedule/${item.id}/mark-given`,
        {
          token,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ administered_date: administeredDate || null }),
        }
      );
      // First element is the dose just marked given; the rest are
      // follow-up doses the catch-up recalculation just created.
      const [given, ...created] = updated;
      setItems(await apiFetch<ScheduleItem[]>(`/children/${childId}/schedule`, { token }));
      setRecalc({ given, created });
    } catch (err) {
      setMarkError(err instanceof ApiError ? err.message : "Failed to mark dose as given");
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-zinc-500">No schedule items yet.</p>;

  const createdIds = new Set(recalc?.created.map((c) => c.id));
  const hasPending = items.some((item) => item.status !== "given");

  return (
    <div className="flex flex-col gap-3">
      {hasPending && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Date given (used by Mark given below)</label>
          <input
            type="date"
            value={administeredDate}
            max={todayISO()}
            onChange={(e) => setAdministeredDate(e.target.value)}
            className="w-44 rounded border px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500">
            A later date than the due date pushes the next dose&apos;s due date back.
          </p>
        </div>
      )}

      {markError && <p className="text-sm text-red-600">{markError}</p>}
      {recalc && (
        <div
          data-testid="recalc-notice"
          className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
        >
          <p>
            Marked {doseLabel(recalc.given)} as given on {recalc.given.administered_date}.
          </p>
          {recalc.created.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {recalc.created.map((c) => (
                <li key={c.id}>
                  Schedule recalculated: {doseLabel(c)} is now due {c.due_date}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">No further doses of this vaccine are due.</p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm ${
              createdIds.has(item.id) ? "ring-2 ring-blue-400" : ""
            }`}
          >
            <span>{doseLabel(item)}</span>
            <span className="text-zinc-500">
              {item.status === "given" && item.administered_date
                ? `given ${item.administered_date}`
                : `due ${item.due_date}`}
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  item.status === "given"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                }`}
              >
                {item.status === "given" ? "given" : "pending"}
              </span>
              {item.status !== "given" && (
                <button
                  type="button"
                  onClick={() => handleMarkGiven(item)}
                  disabled={markingId !== null}
                  className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {markingId === item.id ? "Saving..." : "Mark given"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
