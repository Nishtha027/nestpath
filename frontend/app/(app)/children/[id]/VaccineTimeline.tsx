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
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LIST_ITEM, MUTED } from "@/lib/ui";
import { Icon, type IconName } from "../../../ui/Icon";
import { Message } from "../../../ui/Message";

function doseLabel(item: ScheduleItem) {
  return `${item.vaccine_id.toUpperCase()} dose ${item.dose_number ?? "?"}`;
}

// Each group has its own icon shape as well as a color, so the meaning
// never depends on color alone.
const GROUPS: { key: VaccineGroup; title: string; hint?: string; icon: IconName; tone: string }[] = [
  { key: "dueNow", title: "Due now", icon: "clock", tone: "bg-info-bg text-info-ink" },
  {
    key: "overdue",
    title: "Overdue / catch-up",
    hint: "Ask your pediatrician about catching up -- doses can usually still be given on a catch-up schedule.",
    icon: "alertTriangle",
    tone: "bg-warning-bg text-warning-ink",
  },
  { key: "upcoming", title: "Upcoming", icon: "calendar", tone: "bg-neutral-bg text-neutral-ink" },
  {
    key: "closed",
    title: "No longer recommended at this age",
    hint: "Ask your pediatrician. If one of these was given earlier, while it was still recommended, you can still record the date.",
    icon: "minusCircle",
    tone: "bg-neutral-bg text-neutral-ink",
  },
  { key: "done", title: "Done", icon: "checkCircle", tone: "bg-success-bg text-success-ink" },
];

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

  if (loading) return <p className={MUTED}>Loading...</p>;
  if (error) return <Message tone="error">{error}</Message>;
  if (items.length === 0) return <p className={MUTED}>No schedule items yet.</p>;

  const today = todayISO();
  const groups = groupSchedule(items, today);
  const highlighted = new Set(notice?.kind === "given" ? notice.created.map((c) => c.id) : []);

  return (
    <div className="flex flex-col gap-5">
      <div className={CARD}>
        <p className="font-semibold" data-testid="vaccine-summary">
          {groups.dueNow.length} due now · {groups.overdue.length} overdue · {groups.upcoming.length}{" "}
          upcoming · {groups.done.length} done
          {groups.closed.length > 0 && ` · ${groups.closed.length} no longer recommended`}
        </p>
        <p className={MUTED}>
          Later doses appear after each one is marked done. Based on the US CDC schedule (July 2,
          2025) for healthy children; it isn&apos;t medical advice, and your pediatrician has the
          final say.
        </p>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {actionError && <Message tone="error">{actionError}</Message>}
        {notice && (
          <Message tone="success" data-testid="recalc-notice">
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
          </Message>
        )}
      </div>

      {GROUPS.map(({ key, title, hint, icon, tone }) =>
        groups[key].length === 0 ? null : (
          <section key={key} aria-labelledby={`group-${key}`} className={CARD}>
            <h2 id={`group-${key}`} className="flex flex-wrap items-center gap-2 text-base font-semibold">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${tone}`}>
                <Icon name={icon} className="h-[18px] w-[18px]" />
                {title}
              </span>
              <span className="font-normal text-muted">({groups[key].length})</span>
            </h2>
            {hint && <p className={MUTED}>{hint}</p>}
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
                    className={`flex flex-wrap items-center justify-between gap-3 text-sm ${LIST_ITEM} ${
                      highlighted.has(item.id) ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">{doseLabel(item)}</span>
                      <span className="text-muted">
                        {done
                          ? `given ${item.administered_date}`
                          : closed
                            ? "No longer recommended at this age. Ask your pediatrician."
                            : `due ${item.due_date}`}
                      </span>
                      {showWindowNote(item, today) && (
                        <span className="text-xs text-ink">
                          {item.age_window_note}
                          {!closed && lastDay && ` Last day for this dose: ${lastDay}.`}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
                      >
                        <Icon name={done ? "check" : icon} className="h-3.5 w-3.5" />
                        {done ? "Done" : closed ? "Not recommended now" : "Not done"}
                      </span>
                      {done ? (
                        canUndo(item, items) ? (
                          <button
                            type="button"
                            onClick={() => handleMarkNotDone(item)}
                            disabled={busy}
                            aria-label={`Mark ${doseLabel(item)} as not done`}
                            className={BUTTON_SECONDARY}
                          >
                            {savingId === item.id ? "Saving..." : "Mark not done"}
                          </button>
                        ) : (
                          <span className="text-xs text-muted">
                            Undo the later dose first
                          </span>
                        )
                      ) : (
                        <>
                          <label htmlFor={dateId} className="text-xs font-semibold text-muted">
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
                            className={`${INPUT} text-sm`}
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
                            className={BUTTON_PRIMARY}
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
