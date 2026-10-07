// Groups a child's schedule for the Vaccines tab. The stored status
// ("due_now"/"upcoming") is a snapshot from when the row was created, so
// grouping uses the due date against today instead. Type-only imports, so
// Node's test runner can load this file directly.

import type { ScheduleItem } from "./types";

/** A pending dose more than this many days past its due date shows under
 * "Overdue / catch-up" rather than "Due now". */
export const OVERDUE_AFTER_DAYS = 30;

export type VaccineGroup = "overdue" | "dueNow" | "upcoming" | "closed" | "done";

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

/** Past its hard age limit: no longer recommended at this age, so never
 * shown as due or overdue. The server says so in `status`; the date check
 * covers a window that closes while the page is open. */
export function isWindowClosed(item: ScheduleItem, todayISO: string): boolean {
  if (item.status === "given") return false;
  if (item.status === "age_window_closed") return true;
  return item.window_closes_on !== null && todayISO >= item.window_closes_on;
}

export function groupFor(item: ScheduleItem, todayISO: string): VaccineGroup {
  if (item.status === "given") return "done";
  if (isWindowClosed(item, todayISO)) return "closed";
  const daysPastDue = daysBetween(item.due_date, todayISO);
  if (daysPastDue > OVERDUE_AFTER_DAYS) return "overdue";
  if (daysPastDue >= 0) return "dueNow";
  return "upcoming";
}

export function groupSchedule(items: ScheduleItem[], todayISO: string) {
  const groups: Record<VaccineGroup, ScheduleItem[]> = {
    overdue: [],
    dueNow: [],
    upcoming: [],
    closed: [],
    done: [],
  };
  for (const item of items) groups[groupFor(item, todayISO)].push(item);
  return groups;
}

/** The last day a dose with a hard age limit can be given (the day before
 * window_closes_on), as YYYY-MM-DD. */
export function lastAllowedDay(item: ScheduleItem): string | null {
  if (!item.window_closes_on) return null;
  const d = new Date(`${item.window_closes_on}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Show a dose's age-window note once the limit is this close (or has
 * passed): a baby doesn't need "DTaP is given before age 7" yet, but does
 * need "rotavirus dose 1 only before 15 weeks". */
export const WINDOW_NOTE_LEAD_DAYS = 183;

export function showWindowNote(item: ScheduleItem, todayISO: string): boolean {
  if (item.status === "given" || !item.age_window_note || !item.window_closes_on) return false;
  return daysBetween(todayISO, item.window_closes_on) <= WINDOW_NOTE_LEAD_DAYS;
}

/** Only the latest given dose of a vaccine can be marked not done (the
 * server enforces this too). */
export function canUndo(item: ScheduleItem, items: ScheduleItem[]): boolean {
  if (item.status !== "given") return false;
  return !items.some(
    (other) =>
      other.vaccine_id === item.vaccine_id &&
      other.status === "given" &&
      (other.dose_number ?? 0) > (item.dose_number ?? 0)
  );
}
