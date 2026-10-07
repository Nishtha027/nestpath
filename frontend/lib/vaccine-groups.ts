// Groups a child's schedule for the Vaccines tab. The stored status
// ("due_now"/"upcoming") is a snapshot from when the row was created, so
// grouping uses the due date against today instead. Type-only imports, so
// Node's test runner can load this file directly.

import type { ScheduleItem } from "./types";

/** A pending dose more than this many days past its due date shows under
 * "Overdue / catch-up" rather than "Due now". */
export const OVERDUE_AFTER_DAYS = 30;

export type VaccineGroup = "overdue" | "dueNow" | "upcoming" | "done";

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

export function groupFor(item: ScheduleItem, todayISO: string): VaccineGroup {
  if (item.status === "given") return "done";
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
    done: [],
  };
  for (const item of items) groups[groupFor(item, todayISO)].push(item);
  return groups;
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
