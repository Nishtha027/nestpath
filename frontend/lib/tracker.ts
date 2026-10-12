// The baby tracker's logic, kept free of React so it can be tested directly
// (lib/tracker.test.ts): units, durations and "time since", grouping by
// day, the Log form's draft and its checks, live-feed messages, and the
// numbers behind Insights and the pediatrician summary.
//
// Amounts are always stored in ml; ounces are only for display and input.
// The limits mirror the API's (backend/app/services/care_logs.py), so most
// mistakes are caught before a request is sent.

import type {
  CareLog,
  CareLogLatest,
  CareLogSummary,
  CareLogType,
  DiaperKind,
  FeedSide,
  FeedType,
} from "./types";

export const LIMITS = {
  amountMl: { min: 1, max: 500 },
  feedMin: { min: 1, max: 180 },
  sleepMaxMin: 24 * 60,
  notesMax: 500,
  /** Phone and server clocks differ a little. */
  futureToleranceMs: 5 * 60_000,
} as const;

// ---------------------------------------------------------------- units

export type VolumeUnit = "ml" | "oz";

export const ML_PER_OZ = 29.5735;
/** The ml stepper moves in 10s, the oz stepper in halves. */
const ML_STEP = 10;
const OZ_STEP = 0.5;

export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_OZ);
}

/** An amount in the given unit, without the unit: "120", "4.1". */
export function volumeNumber(ml: number, unit: VolumeUnit): string {
  if (unit === "ml") return String(Math.round(ml));
  return String(Math.round(mlToOz(ml) * 10) / 10);
}

/** "120 ml" or "4.1 oz". */
export function formatVolume(ml: number, unit: VolumeUnit): string {
  return `${volumeNumber(ml, unit)} ${unit}`;
}

/** One press of the amount stepper: to the next round value in the shown
 * unit (10 ml, or half an ounce), kept within the allowed range. */
export function stepVolume(ml: number, direction: 1 | -1, unit: VolumeUnit): number {
  let next: number;
  if (unit === "ml") {
    const snapped = direction > 0 ? Math.floor(ml / ML_STEP) * ML_STEP : Math.ceil(ml / ML_STEP) * ML_STEP;
    next = snapped + direction * ML_STEP;
  } else {
    // Stored ml are whole numbers, so "4 oz" is 118 ml = 3.99 oz: allow a
    // little slack so it still counts as 4.
    const steps = mlToOz(ml) / OZ_STEP;
    const snapped = (direction > 0 ? Math.floor(steps + 0.1) : Math.ceil(steps - 0.1)) * OZ_STEP;
    next = ozToMl(snapped + direction * OZ_STEP);
  }
  const min = unit === "ml" ? ML_STEP : ozToMl(OZ_STEP);
  const max = unit === "ml" ? LIMITS.amountMl.max : ozToMl(Math.floor(mlToOz(LIMITS.amountMl.max) / OZ_STEP) * OZ_STEP);
  return Math.min(max, Math.max(min, next));
}

/** One press of a minutes stepper (5-minute steps). */
export function stepMinutes(minutes: number | null, direction: 1 | -1, start = 15): number {
  if (minutes === null) return start;
  const snapped = direction > 0 ? Math.floor(minutes / 5) * 5 : Math.ceil(minutes / 5) * 5;
  return Math.min(LIMITS.feedMin.max, Math.max(5, snapped + direction * 5));
}

// ----------------------------------------------------------------- time

/** "45 min", "2 h", "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function minutesBetween(from: Date | string, to: Date | string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
}

/** How long ago something happened: "Just now", "5 min ago",
 * "2 h 15 min ago", "3 days ago". */
export function formatTimeSince(iso: string, now: Date): string {
  const minutes = Math.floor(minutesBetween(iso, now));
  if (minutes < 1) return "Just now";
  if (minutes < 24 * 60) return `${formatDuration(minutes)} ago`;
  const days = Math.floor(minutes / (24 * 60));
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** "14:05" or "2:05 PM", as the browser's locale writes times. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** YYYY-MM-DD of a moment, in the browser's timezone. */
export function localDayKey(moment: Date | string): string {
  const d = new Date(moment);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A YYYY-MM-DD day as a local Date (midnight). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Today", "Yesterday", or "Mon, Oct 5". */
export function dayLabel(key: string, now: Date): string {
  if (key === localDayKey(now)) return "Today";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDayKey(yesterday)) return "Yesterday";
  return parseDayKey(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export type DayGroup = { key: string; label: string; entries: CareLog[] };

/** Entries (newest first) split into local calendar days, newest day
 * first. A sleep belongs to the day it started. */
export function groupByDay(entries: CareLog[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const key = localDayKey(entry.occurred_at ?? entry.timestamp);
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, label: dayLabel(key, now), entries: [entry] });
  }
  return groups;
}

/** A Date as an <input type="datetime-local"> value (local, to the minute). */
export function toLocalInput(moment: Date | string): string {
  const d = new Date(moment);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${localDayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An <input type="datetime-local"> value back to a Date, or null. */
export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ------------------------------------------------------ describing entries

const FEED_TITLES: Record<FeedType, string> = { breast: "Breast feed", bottle: "Bottle", solid: "Solids" };
const TYPE_TITLES: Record<CareLogType, string> = { feed: "Feed", sleep: "Sleep", diaper: "Diaper", medication: "Medication" };
export const DIAPER_LABELS: Record<DiaperKind, string> = { wet: "Wet", dirty: "Dirty", both: "Wet and dirty" };
export const SIDE_LABELS: Record<FeedSide, string> = { left: "Left", right: "Right", both: "Both sides" };

export function entryTitle(entry: CareLog): string {
  if (entry.type === "feed" && entry.feed_type) return FEED_TITLES[entry.feed_type];
  return TYPE_TITLES[entry.type];
}

/** How long a sleep lasted (or has lasted so far), in minutes; null for a
 * sleep with no end recorded (older entries). */
export function sleepMinutes(entry: CareLog, now: Date): number | null {
  if (entry.ended_at) return minutesBetween(entry.occurred_at, entry.ended_at);
  if (entry.in_progress) return minutesBetween(entry.occurred_at, now);
  return null;
}

/** The short detail line: "120 ml", "15 min · Left", "1 h 30 min",
 * "Sleeping now · 45 min", "Wet". Null when there's nothing structured. */
export function entryDetail(entry: CareLog, unit: VolumeUnit, now: Date): string | null {
  const parts: string[] = [];
  if (entry.type === "feed") {
    if (entry.amount_ml !== null) parts.push(formatVolume(entry.amount_ml, unit));
    if (entry.duration_min !== null) parts.push(formatDuration(entry.duration_min));
    if (entry.side) parts.push(SIDE_LABELS[entry.side]);
  } else if (entry.type === "sleep") {
    const minutes = sleepMinutes(entry, now);
    if (entry.in_progress) parts.push("Sleeping now");
    if (minutes !== null) parts.push(formatDuration(minutes));
  } else if (entry.type === "diaper" && entry.diaper_kind) {
    parts.push(DIAPER_LABELS[entry.diaper_kind]);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Who logged it: their name, or "Parent 1" if the account has none. */
export function loggedBy(entry: Pick<CareLog, "caregiver_name">): string {
  return entry.caregiver_name?.trim() || "Parent 1";
}

// ------------------------------------------------------------ live feed

export type CareEvent =
  | { kind: "upsert"; entry: CareLog }
  | { kind: "deleted"; id: string; childId: string };

/** One WebSocket message. Created and updated entries arrive as the entry
 * itself (servers before the tracker sent no "event" key); a deletion is
 * {"event": "deleted", "id", "deleted_from_child"}. Anything else: null. */
export function parseCareMessage(data: string): CareEvent | null {
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return null;
  }
  if (!message || typeof message !== "object") return null;
  const m = message as Record<string, unknown>;
  if (m.event === "deleted") {
    return typeof m.id === "string" && typeof m.deleted_from_child === "string"
      ? { kind: "deleted", id: m.id, childId: m.deleted_from_child }
      : null;
  }
  if (typeof m.id !== "string" || typeof m.child_id !== "string" || typeof m.type !== "string") return null;
  return { kind: "upsert", entry: normalizeEntry(m as Partial<CareLog> & Pick<CareLog, "id" | "child_id" | "type">) };
}

/** Fills in the fields an older server doesn't send, so every entry has
 * the same shape. */
export function normalizeEntry(raw: Partial<CareLog> & Pick<CareLog, "id" | "child_id" | "type">): CareLog {
  const occurred = raw.occurred_at ?? raw.timestamp ?? new Date(0).toISOString();
  return {
    caregiver_id: "",
    caregiver_name: null,
    notes: null,
    feed_type: null,
    amount_ml: null,
    duration_min: null,
    side: null,
    ended_at: null,
    in_progress: false,
    diaper_kind: null,
    updated_at: null,
    ...raw,
    occurred_at: occurred,
    timestamp: occurred,
  } as CareLog;
}

/** Union by id, newest first (by when it happened). A catch-up fetch, live
 * pushes and our own saves overlap, so entries are deduped. */
export function mergeEntries(incoming: CareLog[], existing: CareLog[]): CareLog[] {
  const byId = new Map<string, CareLog>();
  for (const entry of [...existing, ...incoming]) byId.set(entry.id, entry);
  return [...byId.values()].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime() || a.id.localeCompare(b.id)
  );
}

/** Applies one live event to a list that shows `type` entries only (or
 * every type when null) of one child. */
export function applyEvent(entries: CareLog[], event: CareEvent, childId: string, type: CareLogType | null): CareLog[] {
  if (event.kind === "deleted") {
    return event.childId === childId ? entries.filter((e) => e.id !== event.id) : entries;
  }
  const { entry } = event;
  if (entry.child_id !== childId) return entries;
  if (type && entry.type !== type) return entries.filter((e) => e.id !== entry.id);
  return mergeEntries([entry], entries);
}

/** The newest entry of each type after one live event, or null when the
 * answer needs the server (an entry that was the newest got deleted, or
 * moved back in time). */
export function applyEventToLatest(latest: CareLogLatest, event: CareEvent, childId: string): CareLogLatest | null {
  if (event.kind === "deleted") {
    if (event.childId !== childId) return latest;
    return Object.values(latest).some((e) => e?.id === event.id) ? null : latest;
  }
  const { entry } = event;
  if (entry.child_id !== childId) return latest;
  const current = latest[entry.type];
  if (!current || new Date(entry.occurred_at) >= new Date(current.occurred_at)) {
    return { ...latest, [entry.type]: entry };
  }
  return current.id === entry.id ? null : latest;
}

// ---------------------------------------------------------- the Log form

/** What the Log and edit forms hold while someone fills them in. Times are
 * <input type="datetime-local"> values; occurredAt "" means "now". */
export type Draft = {
  type: CareLogType;
  feedType: FeedType | null;
  amountMl: number | null;
  durationMin: number | null;
  side: FeedSide | null;
  occurredAt: string;
  endedAt: string;
  inProgress: boolean;
  diaperKind: DiaperKind | null;
  notes: string;
  /** An edited entry's exact times. The inputs only show minutes, so an
   * unchanged field keeps these (seconds and all) instead of rounding. */
  original?: { occurredAt: string; endedAt: string | null };
};

/** A time field's value as a Date: the original exact time if the field
 * still shows it, else what was typed. */
function draftTime(value: string, original: string | null | undefined): Date | null {
  if (original && value === toLocalInput(original)) return new Date(original);
  return fromLocalInput(value);
}

export const DEFAULT_BOTTLE_ML = 120;
export const DEFAULT_SOLID_ML = 60;
export const DEFAULT_BREAST_MIN = 15;

export function newDraft(type: CareLogType, now: Date = new Date()): Draft {
  const base: Draft = {
    type,
    feedType: null,
    amountMl: null,
    durationMin: null,
    side: null,
    occurredAt: "",
    endedAt: "",
    inProgress: false,
    diaperKind: null,
    notes: "",
  };
  if (type === "feed") return withFeedType(base, "bottle");
  if (type === "sleep") {
    // A past sleep: the last hour, to adjust.
    return { ...base, occurredAt: toLocalInput(new Date(now.getTime() - 60 * 60_000)), endedAt: toLocalInput(now) };
  }
  return base;
}

/** Switching Breast / Bottle / Solid: each brings its own sensible
 * defaults, keeping what was already entered where it still applies. */
export function withFeedType(draft: Draft, feedType: FeedType): Draft {
  if (draft.feedType === feedType) return draft;
  if (feedType === "breast") {
    return { ...draft, feedType, amountMl: null, durationMin: DEFAULT_BREAST_MIN };
  }
  return {
    ...draft,
    feedType,
    side: null,
    durationMin: null,
    amountMl: feedType === "bottle" ? DEFAULT_BOTTLE_ML : DEFAULT_SOLID_ML,
  };
}

export function draftFromEntry(entry: CareLog): Draft {
  return {
    type: entry.type,
    feedType: entry.feed_type,
    amountMl: entry.amount_ml,
    durationMin: entry.duration_min,
    side: entry.side,
    occurredAt: toLocalInput(entry.occurred_at),
    endedAt: entry.ended_at ? toLocalInput(entry.ended_at) : "",
    inProgress: entry.in_progress,
    diaperKind: entry.diaper_kind,
    notes: entry.notes ?? "",
    original: { occurredAt: entry.occurred_at, endedAt: entry.ended_at },
  };
}

function inRange(value: number, { min, max }: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** The first problem with a draft, in plain words, or null if it can be
 * saved. Same rules as the API. */
export function validateDraft(draft: Draft, now: Date): string | null {
  const latestAllowed = now.getTime() + LIMITS.futureToleranceMs;
  const occurred = draft.occurredAt === "" ? now : draftTime(draft.occurredAt, draft.original?.occurredAt);
  if (!occurred) return "Enter the time.";
  if (occurred.getTime() > latestAllowed) return "The time can't be in the future.";
  if (draft.notes.trim().length > LIMITS.notesMax) return `Notes can be at most ${LIMITS.notesMax} characters.`;

  if (draft.type === "feed") {
    if (!draft.feedType) return "Choose breast, bottle or solid.";
    if (draft.feedType !== "breast" && draft.amountMl !== null && !inRange(draft.amountMl, LIMITS.amountMl)) {
      return `The amount must be between ${LIMITS.amountMl.min} and ${LIMITS.amountMl.max} ml.`;
    }
    if (draft.durationMin !== null && !inRange(draft.durationMin, LIMITS.feedMin)) {
      return `The duration must be between ${LIMITS.feedMin.min} and ${LIMITS.feedMin.max} minutes.`;
    }
  }
  if (draft.type === "sleep" && !draft.inProgress) {
    const ended = draftTime(draft.endedAt, draft.original?.endedAt);
    if (!ended) return "Enter when the sleep ended.";
    if (ended <= occurred) return "A sleep must end after it starts.";
    if (minutesBetween(occurred, ended) > LIMITS.sleepMaxMin) return "A single sleep can't be longer than 24 hours.";
    if (ended.getTime() > latestAllowed) return "A sleep can't end in the future.";
  }
  if (draft.type === "diaper" && !draft.diaperKind) return "Choose wet, dirty or both.";
  return null;
}

/** The request body for a draft. A new entry leaves out what's unset (the
 * time defaults to now on the server); an edit sends every field of its
 * type, so a cleared one is cleared. */
export function draftPayload(draft: Draft, mode: "create" | "edit"): Record<string, unknown> {
  const body: Record<string, unknown> = { notes: draft.notes.trim() || null };
  if (mode === "create") body.type = draft.type;
  const occurred = draft.occurredAt === "" ? null : draftTime(draft.occurredAt, draft.original?.occurredAt);
  if (occurred) body.occurred_at = occurred.toISOString();

  if (draft.type === "feed") {
    const breast = draft.feedType === "breast";
    body.feed_type = draft.feedType;
    body.amount_ml = breast ? null : draft.amountMl;
    body.duration_min = draft.feedType === "solid" ? null : draft.durationMin;
    body.side = breast ? draft.side : null;
  } else if (draft.type === "sleep") {
    if (draft.inProgress) {
      if (mode === "create") body.in_progress = true;
    } else {
      body.ended_at = draftTime(draft.endedAt, draft.original?.endedAt)?.toISOString() ?? null;
    }
  } else if (draft.type === "diaper") {
    body.diaper_kind = draft.diaperKind;
  }
  if (mode === "create") {
    for (const [key, value] of Object.entries(body)) if (value === null) delete body[key];
  }
  return body;
}

// ------------------------------------------------- Insights and sharing

export type ChartDay = {
  day: string;
  /** Short x-axis label: "Mon" for a week, "Oct 5" for a month. */
  label: string;
  /** Full date for tooltips and tables: "Mon, Oct 5". */
  date: string;
  feeds: number;
  /** Total bottle and solid amount, in the shown unit. */
  volume: number;
  /** Total sleep in hours (one decimal). */
  sleepHours: number;
};

export function chartDays(summary: CareLogSummary, unit: VolumeUnit): ChartDay[] {
  const weekly = summary.days <= 7;
  return summary.daily.map((d) => {
    const date = parseDayKey(d.day);
    return {
      day: d.day,
      label: date.toLocaleDateString(undefined, weekly ? { weekday: "short" } : { month: "short", day: "numeric" }),
      date: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      feeds: d.feeds,
      volume: Number(volumeNumber(d.feed_ml, unit)),
      sleepHours: Math.round((d.sleep_min / 60) * 10) / 10,
    };
  });
}

export type SummaryChip = { label: string; value: string };

const NONE = "No data yet";

/** The four numbers above the Insights charts. */
export function summaryChips(summary: CareLogSummary, unit: VolumeUnit): SummaryChip[] {
  const a = summary.averages;
  return [
    { label: "Average amount", value: a.avg_feed_ml !== null ? formatVolume(a.avg_feed_ml, unit) : NONE },
    { label: "Average feed length", value: a.avg_feed_min !== null ? formatDuration(a.avg_feed_min) : NONE },
    { label: "Feeds per day", value: a.feeds_per_day !== null ? String(Math.round(a.feeds_per_day * 10) / 10) : NONE },
    { label: "Sleep per day", value: a.sleep_min_per_day !== null ? formatDuration(a.sleep_min_per_day) : NONE },
  ];
}

export function diaperCount(d: CareLogSummary["daily"][number]): number {
  return d.diapers_wet + d.diapers_dirty + d.diapers_both + d.diapers_other;
}

/** The pediatrician summary as plain text, for pasting into a message or
 * a patient portal. Numbers only, no judgments. */
export function shareText(childName: string, age: string, summary: CareLogSummary, unit: VolumeUnit): string {
  const first = parseDayKey(summary.start).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = parseDayKey(summary.end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const lines = [`${childName}, ${age}: last ${summary.days} days (${first} to ${last})`, ""];
  for (const d of summary.daily) {
    const date = parseDayKey(d.day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const parts = [`${d.feeds} feed${d.feeds === 1 ? "" : "s"}`];
    if (d.feed_ml > 0) parts.push(`${formatVolume(d.feed_ml, unit)} total`);
    parts.push(`sleep ${formatDuration(d.sleep_min)}`);
    if (d.longest_sleep_min !== null) parts.push(`longest ${formatDuration(d.longest_sleep_min)}`);
    const diapers = diaperCount(d);
    parts.push(`${diapers} diaper${diapers === 1 ? "" : "s"} (${d.diapers_wet} wet, ${d.diapers_dirty} dirty, ${d.diapers_both} both)`);
    lines.push(`${date}: ${parts.join(", ")}`);
  }
  lines.push("", "Daily averages (days with entries):");
  for (const chip of summaryChips(summary, unit)) lines.push(`- ${chip.label}: ${chip.value}`);
  const perDay = summary.averages.diapers_per_day;
  lines.push(`- Diapers per day: ${perDay !== null ? Math.round(perDay * 10) / 10 : NONE}`);
  lines.push("", "Logged in NestPath by the family. Not medical advice.");
  return lines.join("\n");
}

/** The browser's IANA timezone, so the summary's days match the parent's. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
