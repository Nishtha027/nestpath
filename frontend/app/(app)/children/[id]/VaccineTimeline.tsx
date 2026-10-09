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
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, MUTED } from "@/lib/ui";
import { Disclosure } from "../../../ui/Disclosure";
import { Icon, type IconName } from "../../../ui/Icon";
import { Message } from "../../../ui/Message";
import { Loading } from "../../../ui/Loading";
import { BearCub, Sparkle } from "../../../ui/illustrations";

function doseLabel(item: ScheduleItem) {
  return `${item.vaccine_id.toUpperCase()} dose ${item.dose_number ?? "?"}`;
}

// Each group has its own icon shape as well as a color, so the meaning
// never depends on color alone.
// The longer explanations live in the "About this schedule" toggle.
const GROUPS: { key: VaccineGroup; title: string; hint?: string; icon: IconName; tone: string }[] = [
  { key: "dueNow", title: "Due now", icon: "clock", tone: "bg-info-bg text-info-ink" },
  {
    key: "overdue",
    title: "Overdue",
    hint: "Ask your pediatrician about catching up.",
    icon: "alertTriangle",
    tone: "bg-warning-bg text-warning-ink",
  },
  { key: "upcoming", title: "Upcoming", icon: "calendar", tone: "bg-neutral-bg text-neutral-ink" },
  {
    key: "closed",
    title: "No longer recommended",
    hint: "Given earlier? You can still record the date.",
    icon: "minusCircle",
    tone: "bg-neutral-bg text-neutral-ink",
  },
  { key: "done", title: "Done", icon: "checkCircle", tone: "bg-success-bg text-success-ink" },
];

// Groups whose last dose being marked done earns a small celebration.
const CELEBRATED: VaccineGroup[] = ["dueNow", "overdue", "upcoming"];

type Notice =
  | { kind: "given"; given: ScheduleItem; created: ScheduleItem[]; clearedGroup: string | null }
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load vaccines. Refresh to try again."))
      .finally(() => setLoading(false));
  }, [childId, token]);

  async function refetch() {
    const list = await apiFetch<ScheduleItem[]>(`/children/${childId}/schedule`, { token });
    setItems(list);
    return list;
  }

  async function handleMarkDone(item: ScheduleItem) {
    setActionError(null);
    setNotice(null);
    setSavingId(item.id);
    const before = groupSchedule(items, todayISO());
    const fromGroup = CELEBRATED.find((key) => before[key].some((i) => i.id === item.id)) ?? null;
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
      const list = await refetch();
      const cleared = fromGroup !== null && groupSchedule(list, todayISO())[fromGroup].length === 0;
      setNotice({
        kind: "given",
        given,
        created,
        clearedGroup: cleared ? GROUPS.find((g) => g.key === fromGroup)!.title : null,
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
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
      setActionError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <Message tone="error">{error}</Message>;
  if (items.length === 0) return <p className={MUTED}>No vaccines scheduled yet.</p>;

  const today = todayISO();
  const groups = groupSchedule(items, today);
  const highlighted = new Set(notice?.kind === "given" ? notice.created.map((c) => c.id) : []);
  const justDoneId = notice?.kind === "given" ? notice.given.id : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <ul className="flex flex-wrap gap-2" data-testid="vaccine-summary" aria-label="Summary">
          {GROUPS.filter(({ key }) => key === "dueNow" || groups[key].length > 0).map(({ key, title, icon, tone }) => (
            <li
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}
            >
              <Icon name={icon} className="h-4 w-4" />
              {groups[key].length} {title.toLowerCase()}
            </li>
          ))}
        </ul>
        <Disclosure label="About this schedule">
          <p>
            Based on the US CDC schedule for healthy children (July 2, 2025). Later doses appear once
            the earlier one is marked done.
          </p>
          <p>Overdue doses can usually still be given on a catch-up schedule.</p>
          <p>
            Some vaccines are only given up to a certain age, and are listed as no longer recommended
            after that. If one was given earlier, while it was still recommended, you can record the
            date.
          </p>
          <p>Your pediatrician has the final say.</p>
        </Disclosure>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {actionError && <Message tone="error">{actionError}</Message>}
        {notice && (
          <Message tone="success" data-testid="recalc-notice">
            {notice.kind === "given" ? (
              <>
                <p>
                  {doseLabel(notice.given)} marked done ({notice.given.administered_date}).
                </p>
                {notice.created.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5">
                    {notice.created.map((c) => (
                      <li key={c.id}>
                        Next: {doseLabel(c)}, due {c.due_date}.
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">No more doses of this vaccine.</p>
                )}
              </>
            ) : (
              <p>
                {notice.label} marked not done
                {notice.restored
                  ? isWindowClosed(notice.restored, today)
                    ? " (no longer recommended at this age)"
                    : `, due ${notice.restored.due_date}`
                  : ""}
                . Later doses scheduled from it were removed.
              </p>
            )}
          </Message>
        )}
        {notice?.kind === "given" && notice.clearedGroup && (
          <GroupCleared key={notice.given.id} title={notice.clearedGroup} />
        )}
      </div>

      {GROUPS.map(({ key, title, hint, icon, tone }) =>
        groups[key].length === 0 ? null : (
          <section key={key} aria-labelledby={`group-${key}`} className="np-enter flex flex-col gap-2">
            <h2 id={`group-${key}`} className="flex flex-wrap items-center gap-2 text-base font-semibold">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${tone}`}>
                <Icon name={icon} className="h-[18px] w-[18px]" />
                {title}
              </span>
            </h2>
            {hint && <p className={MUTED}>{hint}</p>}
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {groups[key].map((item) => {
                const done = item.status === "given";
                const closed = key === "closed";
                const busy = savingId !== null;
                const dateId = `given-${item.id}`;
                const lastDay = lastAllowedDay(item);
                return (
                  <li
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-3 text-sm px-4 py-3 ${
                      highlighted.has(item.id) ? "ring-2 ring-inset ring-primary" : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">{doseLabel(item)}</span>
                      <span className="text-muted">
                        {done ? `given ${item.administered_date}` : closed ? null : `due ${item.due_date}`}
                      </span>
                      {showWindowNote(item, today) && (
                        <span className="text-xs text-ink">
                          {item.age_window_note}
                          {!closed && lastDay && ` Last day: ${lastDay}.`}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {done && (
                        <span
                          className={`relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
                        >
                          {item.id === justDoneId ? <JustDoneCheck /> : <Icon name="check" className="h-3.5 w-3.5" />}
                          Done
                        </span>
                      )}
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
                          <label htmlFor={dateId} className="sr-only">
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
                            className={key === "dueNow" ? BUTTON_PRIMARY : BUTTON_SECONDARY}
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

/** The check on a dose that was just marked done: it draws itself, with a
 * brief sparkle. Decorative; the "Done" label beside it carries the meaning. */
function JustDoneCheck() {
  return (
    <>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="h-3.5 w-3.5">
        <path
          className="np-draw"
          pathLength={1}
          d="M3 8.5 6.5 12 13 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        viewBox="0 0 40 24"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute -top-3 -right-4 h-6 w-10"
      >
        <Sparkle x={10} y={14} size={4} className="np-pop" style={{ animationDelay: "250ms" }} />
        <Sparkle x={24} y={7} size={5.5} className="np-pop" style={{ animationDelay: "350ms" }} fill="var(--np-art-cheek)" />
        <Sparkle x={33} y={17} size={3.5} className="np-pop" style={{ animationDelay: "450ms" }} />
      </svg>
    </>
  );
}

/** A small celebration when the last dose in a group is marked done. */
function GroupCleared({ title }: { title: string }) {
  return (
    <div className="np-enter flex items-center gap-4 rounded-2xl bg-success-bg px-5 py-3 text-success-ink">
      <div className="relative h-16 w-16 shrink-0">
        <div className="np-cheer h-16 w-16">
          <BearCub happy className="h-16 w-16" />
        </div>
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-16 w-16 overflow-visible">
          <Sparkle x={4} y={14} size={5} className="np-pop" style={{ animationDelay: "150ms" }} />
          <Sparkle x={60} y={10} size={6} className="np-pop" style={{ animationDelay: "300ms" }} fill="var(--np-art-cheek)" />
          <Sparkle x={58} y={44} size={4} className="np-pop" style={{ animationDelay: "450ms" }} />
          <Sparkle x={6} y={46} size={4} className="np-pop" style={{ animationDelay: "550ms" }} fill="var(--np-art-cheek)" />
        </svg>
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="flex items-center gap-1.5 font-bold">
          <Icon name="checkCircle" className="h-[18px] w-[18px]" />
          Nothing left in &ldquo;{title}&rdquo;
        </p>
        <p className="text-sm">New doses appear as they come due.</p>
      </div>
    </div>
  );
}
