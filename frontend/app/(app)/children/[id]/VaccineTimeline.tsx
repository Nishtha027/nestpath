"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import type { ScheduleItem } from "@/lib/types";
import {
  canUndo,
  groupSchedule,
  isWindowClosed,
  lastAllowedDay,
  showWindowNote,
  type VaccineGroup,
} from "@/lib/vaccine-groups";

function doseLabel(item: ScheduleItem) {
  return `${item.vaccine_id.toUpperCase()} dose ${item.dose_number ?? "?"}`;
}

const GROUPS: { key: VaccineGroup; title: string; hint?: string }[] = [
  { key: "dueNow", title: "Due now" },
  {
    key: "overdue",
    title: "Overdue / catch-up",
    hint: "Ask your pediatrician about catching up -- doses can usually still be given on a catch-up schedule.",
  },
  { key: "upcoming", title: "Upcoming" },
  {
    key: "closed",
    title: "No longer recommended at this age",
    hint: "Ask your pediatrician. If one of these was given earlier, while it was still recommended, you can still record the date.",
  },
  { key: "done", title: "Done" },
];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

type Notice =
  | { kind: "given"; given: ScheduleItem; created: ScheduleItem[] }
  | { kind: "undone"; label: string; restored: ScheduleItem | null };

export function VaccineTimeline({ childId, token }: { childId: string; token: string }) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date given, per pending dose (defaults to today).
  const [dates, setDates] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    apiFetch<ScheduleItem[]>(`/children/${childId}/schedule`, { token })
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load schedule"))
      .finally(() => setLoading(false));
  }, [childId, token]);

  async function refetch() {
    setItems(await apiFetch<ScheduleItem[]>(`/children/${childId}/schedule`, { token }));
  }

  async function handleMarkDone(item: ScheduleItem) {
    setActionError(null);
    setNotice(null);
    setSavingId(item.id);
    try {
      const updated = await apiFetch<ScheduleItem[]>(
        `/children/${childId}/schedule/${item.id}/mark-given`,
        {
          token,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ administered_date: dates[item.id] || todayISO() }),
        }
      );
      // First element is the dose just marked given; the rest are
      // follow-up doses the catch-up recalculation just created.
      const [given, ...created] = updated;
      await refetch();
      setNotice({ kind: "given", given, created });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark dose as done");
    } finally {
      setSavingId(null);
    }
  }

  async function handleMarkNotDone(item: ScheduleItem) {
    setActionError(null);
    setNotice(null);
    setSavingId(item.id);
    try {
      const [restored] = await apiFetch<ScheduleItem[]>(
        `/children/${childId}/schedule/${item.id}/mark-not-given`,
        { token, method: "POST" }
      );
      await refetch();
      setNotice({ kind: "undone", label: doseLabel(item), restored: restored ?? null });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark dose as not done");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>;
  if (error) return <p className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  if (items.length === 0)
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">No schedule items yet.</p>;

  const today = todayISO();
  const groups = groupSchedule(items, today);
  const highlighted = new Set(notice?.kind === "given" ? notice.created.map((c) => c.id) : []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium" data-testid="vaccine-summary">
        {groups.dueNow.length} due now · {groups.overdue.length} overdue · {groups.upcoming.length}{" "}
        upcoming · {groups.done.length} done
        {groups.closed.length > 0 && ` · ${groups.closed.length} no longer recommended`}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Later doses appear after each one is marked done. Based on the US CDC schedule (July 2,
        2025) for healthy children; it isn&apos;t medical advice, and your pediatrician has the
        final say.
      </p>

      <div aria-live="polite" className="flex flex-col gap-2">
        {actionError && <p className="text-sm text-red-700 dark:text-red-400">{actionError}</p>}
        {notice && (
          <div
            data-testid="recalc-notice"
            className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
          >
            {notice.kind === "given" ? (
              <>
                <p>
                  Marked {doseLabel(notice.given)} as done on {notice.given.administered_date}.
                </p>
                {notice.created.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5">
                    {notice.created.map((c) => (
                      <li key={c.id}>
                        Schedule recalculated: {doseLabel(c)} is now due {c.due_date}.
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">No further doses of this vaccine are due.</p>
                )}
              </>
            ) : (
              <p>
                Marked {notice.label} as not done
                {notice.restored
                  ? isWindowClosed(notice.restored, today)
                    ? "; it is no longer recommended at this age"
                    : `; it is due ${notice.restored.due_date}`
                  : ""}
                . Any later dose that was scheduled from it has been removed.
              </p>
            )}
          </div>
        )}
      </div>

      {GROUPS.map(({ key, title, hint }) =>
        groups[key].length === 0 ? null : (
          <section key={key} aria-labelledby={`group-${key}`} className="flex flex-col gap-2">
            <h2 id={`group-${key}`} className="text-base font-medium">
              {title} <span className="text-zinc-600 dark:text-zinc-400">({groups[key].length})</span>
            </h2>
            {hint && <p className="text-sm text-zinc-600 dark:text-zinc-400">{hint}</p>}
            <ul className="flex flex-col gap-2">
              {groups[key].map((item) => {
                const done = item.status === "given";
                const closed = key === "closed";
                const busy = savingId !== null;
                const dateId = `given-${item.id}`;
                const lastDay = lastAllowedDay(item);
                return (
                  <li
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded border border-black/15 px-3 py-2 text-sm dark:border-white/20 ${
                      highlighted.has(item.id) ? "ring-2 ring-blue-500" : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{doseLabel(item)}</span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {done
                          ? `given ${item.administered_date}`
                          : closed
                            ? "No longer recommended at this age. Ask your pediatrician."
                            : `due ${item.due_date}`}
                      </span>
                      {showWindowNote(item, today) && (
                        <span className="text-xs text-zinc-700 dark:text-zinc-300">
                          {item.age_window_note}
                          {!closed && lastDay && ` Last day for this dose: ${lastDay}.`}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          done
                            ? "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100"
                            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                        }`}
                      >
                        {done ? "Done" : closed ? "Not recommended now" : "Not done"}
                      </span>
                      {done ? (
                        canUndo(item, items) ? (
                          <button
                            type="button"
                            onClick={() => handleMarkNotDone(item)}
                            disabled={busy}
                            aria-label={`Mark ${doseLabel(item)} as not done`}
                            className={`rounded border border-black/25 px-3 py-1 hover:bg-black/[.05] disabled:opacity-50 dark:border-white/30 dark:hover:bg-white/[.08] ${FOCUS}`}
                          >
                            {savingId === item.id ? "Saving..." : "Mark not done"}
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            Undo the later dose first
                          </span>
                        )
                      ) : (
                        <>
                          <label htmlFor={dateId} className="text-xs text-zinc-600 dark:text-zinc-400">
                            Date given
                          </label>
                          <input
                            id={dateId}
                            type="date"
                            value={dates[item.id] ?? today}
                            max={today}
                            onChange={(e) =>
                              setDates((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className={`rounded border border-black/25 px-2 py-1 dark:border-white/30 ${FOCUS}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleMarkDone(item)}
                            disabled={busy}
                            aria-label={
                              closed
                                ? `Record ${doseLabel(item)} as given earlier`
                                : `Mark ${doseLabel(item)} as done`
                            }
                            className={`rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black ${FOCUS}`}
                          >
                            {savingId === item.id ? "Saving..." : closed ? "Record as given" : "Mark done"}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
