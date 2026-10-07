// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERDUE_AFTER_DAYS, canUndo, groupFor, groupSchedule } from "./vaccine-groups.ts";
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

test("only the latest given dose of a vaccine can be undone", () => {
  const d1 = item({ id: "1", dose_number: 1, status: "given" });
  const d2 = item({ id: "2", dose_number: 2, status: "given" });
  const pending = item({ id: "3", dose_number: 3, status: "upcoming" });
  const all = [d1, d2, pending];
  assert.equal(canUndo(d1, all), false);
  assert.equal(canUndo(d2, all), true);
  assert.equal(canUndo(pending, all), false);
});
