// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// The tracker's logic: units, time since, grouping by day, the Log form's
// checks and request bodies, live-feed messages and the Insights numbers.
// Times are built with local Date constructors, so the tests pass in any
// timezone.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CareLog, CareLogLatest, CareLogSummary } from "./types.ts";
import {
  applyEvent,
  applyEventToLatest,
  chartDays,
  dayLabel,
  draftFromEntry,
  draftPayload,
  entryDetail,
  entrySummary,
  entryTitle,
  formatDuration,
  formatTimeSince,
  formatVolume,
  fromLocalInput,
  groupByDay,
  loggedBy,
  mergeEntries,
  mlToOz,
  newDraft,
  ozToMl,
  parseCareMessage,
  shareText,
  averagesNote,
  stepMinutes,
  stepVolume,
  summaryChips,
  toLocalInput,
  validateDraft,
  withFeedType,
  type Draft,
} from "./tracker.ts";

const NOW = new Date(2026, 9, 12, 15, 30); // Mon Oct 12 2026, 15:30 local

function entry(overrides: Partial<CareLog> & { occurred_at: string }): CareLog {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    child_id: "child-1",
    caregiver_id: "cg-1",
    caregiver_name: "Alex",
    type: "feed",
    notes: null,
    feed_type: null,
    amount_ml: null,
    duration_min: null,
    side: null,
    ended_at: null,
    in_progress: false,
    diaper_kind: null,
    updated_at: null,
    ...overrides,
    timestamp: overrides.occurred_at,
  };
}

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

test("ml and oz convert both ways, and amounts are stored in whole ml", () => {
  assert.equal(ozToMl(4), 118);
  assert.equal(Math.round(mlToOz(120) * 10) / 10, 4.1);
  assert.equal(formatVolume(120, "ml"), "120 ml");
  assert.equal(formatVolume(120, "oz"), "4.1 oz");
  assert.equal(formatVolume(ozToMl(4), "oz"), "4 oz");
});

test("the amount stepper moves to round values in the shown unit, within limits", () => {
  assert.equal(stepVolume(120, 1, "ml"), 130);
  assert.equal(stepVolume(120, -1, "ml"), 110);
  assert.equal(stepVolume(125, 1, "ml"), 130); // snaps to the next 10
  assert.equal(stepVolume(125, -1, "ml"), 120);
  assert.equal(stepVolume(10, -1, "ml"), 10); // never below one step
  assert.equal(stepVolume(500, 1, "ml"), 500);
  // In ounces: half-ounce steps, stored as ml.
  assert.equal(stepVolume(ozToMl(4), 1, "oz"), ozToMl(4.5));
  assert.equal(stepVolume(120, 1, "oz"), ozToMl(4.5)); // 4.06 oz -> 4.5
  assert.equal(stepVolume(120, -1, "oz"), ozToMl(4));
  assert.ok(stepVolume(500, 1, "oz") <= 500);
  assert.equal(stepVolume(15, -1, "oz"), ozToMl(0.5));
});

test("the minutes stepper uses 5-minute steps from 5 to 180", () => {
  assert.equal(stepMinutes(null, 1), 15);
  assert.equal(stepMinutes(15, 1), 20);
  assert.equal(stepMinutes(12, 1), 15);
  assert.equal(stepMinutes(12, -1), 10);
  assert.equal(stepMinutes(5, -1), 5);
  assert.equal(stepMinutes(180, 1), 180);
});

test("durations and time since read naturally", () => {
  assert.equal(formatDuration(0), "0 min");
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(90), "1 h 30 min");
  assert.equal(formatDuration(89.6), "1 h 30 min");
  const ago = (minutes: number) => formatTimeSince(new Date(NOW.getTime() - minutes * 60_000).toISOString(), NOW);
  assert.equal(ago(0), "Just now");
  assert.equal(ago(0.5), "Just now");
  assert.equal(ago(5), "5 min ago");
  assert.equal(ago(135), "2 h 15 min ago");
  assert.equal(ago(24 * 60 + 5), "1 day ago");
  assert.equal(ago(3 * 24 * 60), "3 days ago");
});

test("entries are grouped by local day, newest first, labelled Today and Yesterday", () => {
  const list = [
    entry({ id: "a", occurred_at: at(12, 9) }),
    entry({ id: "b", occurred_at: at(12, 0, 5) }),
    entry({ id: "c", occurred_at: at(11, 23, 55) }),
    entry({ id: "d", occurred_at: at(9, 8) }),
  ];
  const groups = groupByDay(list, NOW);
  assert.deepEqual(
    groups.map((g) => [g.label, g.entries.map((e) => e.id)]),
    [
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      [dayLabel("2026-10-09", NOW), ["d"]],
    ]
  );
  assert.match(groups[2].label, /Oct/);
  assert.deepEqual(groupByDay([], NOW), []);
});

test("datetime-local values round-trip", () => {
  const d = new Date(2026, 9, 12, 7, 5);
  assert.equal(toLocalInput(d), "2026-10-12T07:05");
  assert.equal(fromLocalInput("2026-10-12T07:05")?.getTime(), d.getTime());
  assert.equal(fromLocalInput(""), null);
  assert.equal(fromLocalInput("not a time"), null);
});

test("entries are described briefly, and old entries still read fine", () => {
  const bottle = entry({ occurred_at: at(12, 9), feed_type: "bottle", amount_ml: 120 });
  assert.equal(entryTitle(bottle), "Bottle");
  assert.equal(entryDetail(bottle, "ml", NOW), "120 ml");
  assert.equal(entryDetail(bottle, "oz", NOW), "4.1 oz");

  const breast = entry({ occurred_at: at(12, 9), feed_type: "breast", duration_min: 15, side: "left" });
  assert.equal(entryTitle(breast), "Breast feed");
  assert.equal(entryDetail(breast, "ml", NOW), "15 min · Left");

  const nap = entry({ type: "sleep", occurred_at: at(12, 13), ended_at: at(12, 14, 30) });
  assert.equal(entryDetail(nap, "ml", NOW), "1 h 30 min");
  const sleeping = entry({ type: "sleep", occurred_at: at(12, 14, 45), in_progress: true });
  assert.equal(entryDetail(sleeping, "ml", NOW), "Sleeping now · 45 min");

  const diaper = entry({ type: "diaper", occurred_at: at(12, 9), diaper_kind: "both" });
  assert.equal(entryDetail(diaper, "ml", NOW), "Wet and dirty");

  // Before the tracker: type and notes only.
  const old = entry({ occurred_at: at(1, 9), notes: "4oz bottle" });
  assert.equal(entryTitle(old), "Feed");
  assert.equal(entryDetail(old, "ml", NOW), null);
  assert.equal(entryDetail(entry({ type: "sleep", occurred_at: at(1, 9) }), "ml", NOW), null);

  // History's line: always something, even for old entries.
  const line = (e: CareLog) => entrySummary(e, "ml", NOW);
  assert.equal(line({ ...bottle, duration_min: 15 }), "Bottle, 120 ml, 15 min");
  assert.equal(line(breast), "Breast feed, 15 min, left");
  assert.equal(line(entry({ occurred_at: at(12, 9), feed_type: "solid" })), "Solids");
  assert.equal(line(nap), "Slept 1 h 30 min");
  assert.equal(line(sleeping), "Sleeping now, 45 min so far");
  assert.equal(line(entry({ type: "diaper", occurred_at: at(12, 9), diaper_kind: "wet" })), "Wet diaper");
  assert.equal(line(old), "Feed logged");
  assert.equal(line(entry({ type: "sleep", occurred_at: at(1, 9) })), "Sleep logged");
  assert.equal(line(entry({ type: "diaper", occurred_at: at(1, 9) })), "Diaper change logged");
  assert.equal(line(entry({ type: "medication", occurred_at: at(1, 9) })), "Medication logged");

  assert.equal(loggedBy({ caregiver_name: "Sam" }), "Sam");
  assert.equal(loggedBy({ caregiver_name: null }), "Parent 1");
  assert.equal(loggedBy({ caregiver_name: "  " }), "Parent 1");
});

test("switching feed type brings sensible defaults", () => {
  const bottle = newDraft("feed", NOW);
  assert.equal(bottle.feedType, "bottle");
  assert.equal(bottle.amountMl, 120);
  const breast = withFeedType({ ...bottle, amountMl: 150 }, "breast");
  assert.equal(breast.amountMl, null);
  assert.equal(breast.durationMin, 15);
  const solid = withFeedType({ ...breast, side: "left" }, "solid");
  assert.equal(solid.side, null);
  assert.equal(solid.durationMin, null);
  assert.equal(solid.amountMl, 60);
  // Choosing the same type again keeps what was entered.
  assert.equal(withFeedType({ ...bottle, amountMl: 150 }, "bottle").amountMl, 150);
});

function draft(overrides: Partial<Draft>): Draft {
  return { ...newDraft(overrides.type ?? "feed", NOW), ...overrides };
}

test("the Log form catches mistakes with the API's rules", () => {
  assert.equal(validateDraft(draft({}), NOW), null);
  assert.equal(validateDraft(draft({ feedType: null }), NOW), "Choose breast, bottle or solid.");
  assert.match(validateDraft(draft({ amountMl: 600 }), NOW)!, /between 1 and 500 ml/);
  assert.match(validateDraft(draft({ amountMl: 0 }), NOW)!, /between 1 and 500 ml/);
  assert.match(validateDraft(draft({ feedType: "breast", amountMl: null, durationMin: 200 }), NOW)!, /between 1 and 180 minutes/);
  assert.equal(validateDraft(draft({ notes: "x".repeat(501) }), NOW), "Notes can be at most 500 characters.");

  // Time: "now" is fine, a few minutes ahead is tolerated, later isn't.
  assert.equal(validateDraft(draft({ occurredAt: toLocalInput(new Date(NOW.getTime() + 4 * 60_000)) }), NOW), null);
  assert.equal(validateDraft(draft({ occurredAt: "2026-10-12T16:00" }), NOW), "The time can't be in the future.");
  assert.equal(validateDraft(draft({ occurredAt: "garbage" }), NOW), "Enter the time.");

  const sleep = newDraft("sleep", NOW);
  assert.equal(validateDraft(sleep, NOW), null);
  assert.equal(validateDraft({ ...sleep, endedAt: "" }, NOW), "Enter when the sleep ended.");
  assert.equal(validateDraft({ ...sleep, endedAt: sleep.occurredAt }, NOW), "A sleep must end after it starts.");
  assert.equal(
    validateDraft({ ...sleep, occurredAt: "2026-10-10T10:00", endedAt: "2026-10-11T11:00" }, NOW),
    "A single sleep can't be longer than 24 hours."
  );
  assert.equal(validateDraft({ ...sleep, endedAt: "2026-10-12T17:00" }, NOW), "A sleep can't end in the future.");
  assert.equal(validateDraft({ ...sleep, endedAt: "", inProgress: true }, NOW), null);

  assert.equal(validateDraft(draft({ type: "diaper" }), NOW), "Choose wet, dirty or both.");
  assert.equal(validateDraft(draft({ type: "diaper", diaperKind: "wet" }), NOW), null);
});

test("a new entry sends only what applies; an edit clears what no longer does", () => {
  assert.deepEqual(draftPayload(draft({}), "create"), { type: "feed", feed_type: "bottle", amount_ml: 120 });
  assert.deepEqual(
    draftPayload(draft({ feedType: "breast", amountMl: 120, durationMin: 15, side: "left", notes: " sleepy " }), "create"),
    { type: "feed", notes: "sleepy", feed_type: "breast", duration_min: 15, side: "left" }
  );
  const custom = draftPayload(draft({ occurredAt: "2026-10-12T07:05" }), "create");
  assert.equal(custom.occurred_at, new Date(2026, 9, 12, 7, 5).toISOString());

  assert.deepEqual(draftPayload(draft({ type: "sleep", inProgress: true, occurredAt: "" }), "create"), {
    type: "sleep",
    in_progress: true,
  });
  const pastSleep = draftPayload(newDraft("sleep", NOW), "create");
  assert.equal(pastSleep.ended_at, new Date(2026, 9, 12, 15, 30).toISOString());
  assert.deepEqual(draftPayload(draft({ type: "diaper", diaperKind: "dirty" }), "create"), {
    type: "diaper",
    diaper_kind: "dirty",
  });

  // Editing a bottle into a breast feed clears the amount; no type is sent.
  const edited = draftPayload(
    { ...draftFromEntry(entry({ occurred_at: at(12, 9), feed_type: "bottle", amount_ml: 120, notes: "x" })), feedType: "breast", side: "right", notes: "" },
    "edit"
  );
  assert.deepEqual(edited, {
    notes: null,
    occurred_at: new Date(2026, 9, 12, 9).toISOString(),
    feed_type: "breast",
    amount_ml: null,
    duration_min: null,
    side: "right",
  });
  // Unchanged times keep their seconds: a 30-second sleep can still be
  // saved after editing only its note.
  const short = entry({ type: "sleep", occurred_at: "2026-10-12T09:30:10.000Z", ended_at: "2026-10-12T09:30:40.000Z" });
  const shortDraft = { ...draftFromEntry(short), notes: "short" };
  assert.equal(validateDraft(shortDraft, NOW), null);
  assert.deepEqual(draftPayload(shortDraft, "edit"), {
    notes: "short",
    occurred_at: "2026-10-12T09:30:10.000Z",
    ended_at: "2026-10-12T09:30:40.000Z",
  });
  // A changed field uses what was typed.
  const moved = draftPayload({ ...shortDraft, endedAt: toLocalInput(new Date(2026, 9, 11, 14, 0)) }, "edit");
  assert.equal(moved.ended_at, new Date(2026, 9, 11, 14, 0).toISOString());
  // A running sleep's edit leaves the timer alone.
  const running = draftPayload(draftFromEntry(entry({ type: "sleep", occurred_at: at(12, 14), in_progress: true })), "edit");
  assert.deepEqual(Object.keys(running).sort(), ["notes", "occurred_at"]);
});

test("live messages: entries, updates and deletions, and nothing else", () => {
  const created = entry({ id: "e1", occurred_at: at(12, 9), feed_type: "bottle", amount_ml: 90 });
  assert.deepEqual(parseCareMessage(JSON.stringify({ ...created, event: "created" })), {
    kind: "upsert",
    entry: { ...created, event: "created" },
  });
  // A server from before the tracker: no event key, fewer fields.
  const legacy = parseCareMessage(
    JSON.stringify({ id: "e2", child_id: "child-1", caregiver_id: "cg", type: "diaper", timestamp: at(12, 9), notes: null })
  );
  assert.equal(legacy?.kind, "upsert");
  assert.equal(legacy?.kind === "upsert" && legacy.entry.occurred_at, at(12, 9));
  assert.equal(legacy?.kind === "upsert" && legacy.entry.in_progress, false);

  assert.deepEqual(parseCareMessage(JSON.stringify({ event: "deleted", id: "e1", deleted_from_child: "child-1" })), {
    kind: "deleted",
    id: "e1",
    childId: "child-1",
  });
  assert.equal(parseCareMessage("not json"), null);
  assert.equal(parseCareMessage(JSON.stringify({ hello: 1 })), null);
  assert.equal(parseCareMessage("null"), null);
});

test("live events update a list: merged by id, filtered by type and child", () => {
  const a = entry({ id: "a", occurred_at: at(12, 9) });
  const b = entry({ id: "b", type: "diaper", occurred_at: at(12, 10) });
  assert.deepEqual(mergeEntries([a], [b, a]).map((e) => e.id), ["b", "a"]);

  let list = [a];
  list = applyEvent(list, { kind: "upsert", entry: b }, "child-1", null);
  assert.deepEqual(list.map((e) => e.id), ["b", "a"]);
  // A feed-only list ignores diapers, and drops an entry that's no longer a feed.
  assert.deepEqual(applyEvent([a], { kind: "upsert", entry: b }, "child-1", "feed").map((e) => e.id), ["a"]);
  // Another child's entry is ignored.
  assert.deepEqual(applyEvent([a], { kind: "upsert", entry: { ...b, child_id: "child-2" } }, "child-1", null), [a]);
  // Updates replace in place (and re-sort by time).
  const moved = { ...a, occurred_at: at(12, 11) };
  assert.deepEqual(applyEvent(list, { kind: "upsert", entry: moved }, "child-1", null).map((e) => e.id), ["a", "b"]);
  assert.deepEqual(applyEvent(list, { kind: "deleted", id: "a", childId: "child-1" }, "child-1", null).map((e) => e.id), ["b"]);
  assert.equal(applyEvent(list, { kind: "deleted", id: "a", childId: "child-2" }, "child-1", null), list);
});

test("the Home tiles follow live events, asking the server only when they must", () => {
  const feed = entry({ id: "f1", occurred_at: at(12, 9) });
  const latest: CareLogLatest = { feed, sleep: null, diaper: null, medication: null };
  const newer = entry({ id: "f2", occurred_at: at(12, 11) });
  assert.equal(applyEventToLatest(latest, { kind: "upsert", entry: newer }, "child-1")?.feed?.id, "f2");
  // An older entry added after the fact changes nothing.
  const older = entry({ id: "f0", occurred_at: at(12, 7) });
  assert.equal(applyEventToLatest(latest, { kind: "upsert", entry: older }, "child-1"), latest);
  // The newest one moved back in time, or was deleted: refetch.
  assert.equal(applyEventToLatest(latest, { kind: "upsert", entry: { ...feed, occurred_at: at(12, 6) } }, "child-1"), null);
  assert.equal(applyEventToLatest(latest, { kind: "deleted", id: "f1", childId: "child-1" }, "child-1"), null);
  assert.equal(applyEventToLatest(latest, { kind: "deleted", id: "zz", childId: "child-1" }, "child-1"), latest);
  // A sleep being stopped updates the sleep tile in place.
  const running = entry({ id: "s1", type: "sleep", occurred_at: at(12, 14), in_progress: true });
  const withSleep = applyEventToLatest(latest, { kind: "upsert", entry: running }, "child-1")!;
  const stopped = applyEventToLatest(withSleep, { kind: "upsert", entry: { ...running, in_progress: false, ended_at: at(12, 15) } }, "child-1");
  assert.equal(stopped?.sleep?.in_progress, false);
});

function summary(days: CareLogSummary["daily"], extra: Partial<CareLogSummary["averages"]> = {}): CareLogSummary {
  return {
    days: days.length,
    timezone: "UTC",
    start: days[0].day,
    end: days.at(-1)!.day,
    daily: days,
    averages: {
      days_with_entries: days.length,
      feeds_per_day: 7.14,
      feed_ml_per_day: 700,
      avg_feed_ml: 118.4,
      avg_feed_min: 14.6,
      diapers_per_day: 6.5,
      sleep_min_per_day: 800,
      ...extra,
    },
  };
}

function day(key: string, overrides: Partial<CareLogSummary["daily"][number]> = {}) {
  return {
    day: key,
    feeds: 7,
    feed_ml: 720,
    avg_feed_ml: 120,
    avg_feed_min: 15,
    diapers_wet: 4,
    diapers_dirty: 1,
    diapers_both: 1,
    diapers_other: 0,
    sleep_min: 810,
    longest_sleep_min: 300,
    ...overrides,
  };
}

test("chart data: one bar per day, in the shown unit, sleep in hours", () => {
  const data = chartDays(summary([day("2026-10-11"), day("2026-10-12", { feeds: 0, feed_ml: 0, sleep_min: 0 })]), "oz");
  assert.equal(data.length, 2);
  assert.equal(data[0].label, new Date(2026, 9, 11).toLocaleDateString(undefined, { weekday: "short" }));
  assert.equal(data[0].volume, 24.3);
  assert.equal(data[0].sleepHours, 13.5);
  // Days without entries are still there, at zero.
  assert.deepEqual([data[1].feeds, data[1].volume, data[1].sleepHours], [0, 0, 0]);
  // The last day is today: marked as partial, by words as well as style.
  assert.deepEqual([data[0].partial, data[1].partial], [false, true]);
  assert.equal(data[1].label, "Today");
  assert.equal(data[1].date, "Today so far");
});

test("the averages leave out today when there are finished days", () => {
  const withToday = summary([day("2026-10-11"), day("2026-10-12", { feeds: 1 })], { feeds_per_day: 4 });
  const before = { ...withToday.averages, days_with_entries: 1, feeds_per_day: 7 };
  const s = { ...withToday, averages_excluding_today: before };
  assert.equal(summaryChips(s, "ml")[2].value, "7");
  assert.equal(averagesNote(s), "Averages over the 1 day with entries, not counting today.");
  // Only today has entries: today's numbers so far, said so.
  const onlyToday = { ...s, averages_excluding_today: { ...before, days_with_entries: 0, feeds_per_day: null } };
  assert.equal(summaryChips(onlyToday, "ml")[2].value, "4");
  assert.equal(averagesNote(onlyToday), "Averages over the 2 days with entries, including today so far.");
  // An older server without the field: the plain averages.
  assert.equal(summaryChips(withToday, "ml")[2].value, "4");
});

test("summary chips round sensibly and say when there's no data", () => {
  const chips = summaryChips(summary([day("2026-10-12")]), "ml");
  assert.deepEqual(chips, [
    { label: "Average amount", value: "118 ml" },
    { label: "Average feed length", value: "15 min" },
    { label: "Feeds per day", value: "7.1" },
    { label: "Sleep per day", value: "13 h 20 min" },
  ]);
  const empty = summaryChips(
    summary([day("2026-10-12")], { avg_feed_ml: null, avg_feed_min: null, feeds_per_day: null, sleep_min_per_day: null }),
    "ml"
  );
  assert.ok(empty.every((chip) => chip.value === "No data yet"));
});

test("the pediatrician summary is plain, neutral text with every day", () => {
  const text = shareText("Mia", "4 months old", summary([day("2026-10-11"), day("2026-10-12", { feed_ml: 0 })]), "ml");
  const lines = text.split("\n");
  assert.match(lines[0], /^Mia, 4 months old: last 2 days \(.+ to .+\)$/);
  assert.match(text, /7 feeds, 720 ml total, sleep 13 h 30 min, longest 5 h, 6 diapers \(4 wet, 1 dirty, 1 both\)/);
  assert.match(text, /- Feeds per day: 7.1/);
  assert.match(text, /- Diapers per day: 6.5/);
  assert.match(text, /Today so far: 7 feeds, sleep 13 h 30 min/);
  assert.match(text, /Not medical advice\./);
  assert.doesNotMatch(text, /too (much|little)|enough|should|normal/i);
});
