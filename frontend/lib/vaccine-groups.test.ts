// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OVERDUE_AFTER_DAYS,
  canUndo,
  groupFor,
  groupSchedule,
  lastAllowedDay,
  showWindowNote,
} from "./vaccine-groups.ts";
import type { ScheduleItem } from "./types";

function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "x",
    child_id: "c",
    type: "vaccine_dose",
    vaccine_id: "dtap",
    dose_number: 1,
    due_date: "2026-10-07",
    status: "due_now",
    administered_date: null,
    notes: null,
    source_version: null,
    window_closes_on: null,
    age_window_note: null,
    ...overrides,
  };
}

const today = "2026-10-07";

test("groups by due date against today, not the stored status", () => {
  assert.equal(groupFor(item({ due_date: "2026-10-07", status: "upcoming" }), today), "dueNow");
  assert.equal(groupFor(item({ due_date: "2026-10-08", status: "due_now" }), today), "upcoming");
  assert.equal(groupFor(item({ status: "given", administered_date: "2026-10-01" }), today), "done");
});

test(`overdue only after more than ${OVERDUE_AFTER_DAYS} days past due`, () => {
  assert.equal(groupFor(item({ due_date: "2026-09-07" }), today), "dueNow"); // 30 days
  assert.equal(groupFor(item({ due_date: "2026-09-06" }), today), "overdue"); // 31 days
});

test("groupSchedule puts every item in exactly one group", () => {
  const items = [
    item({ id: "a", due_date: "2026-01-01" }),
    item({ id: "b", due_date: "2026-10-01" }),
    item({ id: "c", due_date: "2026-12-01" }),
    item({ id: "d", status: "given" }),
  ];
  const groups = groupSchedule(items, today);
  assert.deepEqual(
    [groups.overdue, groups.dueNow, groups.upcoming, groups.done].map((g) => g.map((i) => i.id)),
    [["a"], ["b"], ["c"], ["d"]]
  );
});

test("a dose past its age window is never due or overdue", () => {
  // Rotavirus dose 1 for a 6-month-old: due date long past, window closed.
  const rv = item({
    vaccine_id: "rotavirus",
    due_date: "2026-06-01",
    status: "age_window_closed",
    window_closes_on: "2026-07-15",
  });
  assert.equal(groupFor(rv, today), "closed");
  // Row written while open, window closed since: still closed, by date.
  assert.equal(groupFor({ ...rv, status: "due_now" }, today), "closed");
  // The day before the window closes it is still due.
  assert.equal(groupFor({ ...rv, status: "due_now" }, "2026-07-14"), "overdue");
  // A given dose is done regardless of its window.
  assert.equal(groupFor({ ...rv, status: "given" }, today), "done");
});

test("age-window note shows when the limit is near or passed, not years away", () => {
  const note = { age_window_note: "Only before 15 weeks.", status: "due_now" };
  assert.equal(showWindowNote(item({ ...note, window_closes_on: "2026-10-30" }), today), true);
  assert.equal(showWindowNote(item({ ...note, window_closes_on: "2026-07-15" }), today), true);
  assert.equal(showWindowNote(item({ ...note, window_closes_on: "2033-04-01" }), today), false);
  assert.equal(
    showWindowNote(item({ ...note, status: "given", window_closes_on: "2026-10-30" }), today),
    false
  );
  assert.equal(showWindowNote(item({ window_closes_on: "2026-10-30" }), today), false);
});

test("last allowed day is the day before the window closes", () => {
  assert.equal(lastAllowedDay(item({ window_closes_on: "2026-07-15" })), "2026-07-14");
  assert.equal(lastAllowedDay(item({ window_closes_on: "2026-03-01" })), "2026-02-28");
  assert.equal(lastAllowedDay(item({})), null);
});

test("only the latest given dose of a vaccine can be undone", () => {
  const d1 = item({ id: "1", dose_number: 1, status: "given" });
  const d2 = item({ id: "2", dose_number: 2, status: "given" });
  const pending = item({ id: "3", dose_number: 3, status: "upcoming" });
  const all = [d1, d2, pending];
  assert.equal(canUndo(d1, all), false);
  assert.equal(canUndo(d2, all), true);
  assert.equal(canUndo(pending, all), false);
});
