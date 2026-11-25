// What a spoken (or typed) sentence asks NestPath to do. The voice
// assistant (app/(app)/VoiceAssistant.tsx) turns speech into text with the
// browser's own speech recognition, then this file turns the text into one
// action: log an entry, start or stop the sleep timer, open a page, or
// open a form when a detail is missing. It is plain rules, no network and
// no model, so it is instant, free and testable (lib/voice-intent.test.ts).

import { LIMITS, ML_PER_OZ, type VolumeUnit } from "./tracker.ts";
import type { CareLogType, DiaperKind, FeedSide } from "./types.ts";

/** Sections a sentence can open, by their lib/nav.ts keys. */
export type VoiceSection =
  | "home"
  | "log"
  | "history"
  | "insights"
  | "vaccines"
  | "growth"
  | "appointments"
  | "wellbeing"
  | "help-board";

export type VoiceIntent =
  /** Save a new care-log entry (POST /children/{id}/care-logs). */
  | { kind: "log"; type: CareLogType; payload: Record<string, unknown>; summary: string }
  /** Start the sleep timer, from `startedAt` when a time was said. */
  | { kind: "sleep-start"; startedAt: string | null; summary: string }
  /** Stop the running timer, at `endedAt` when a time was said. */
  | { kind: "sleep-stop"; endedAt: string | null; summary: string }
  | { kind: "navigate"; section: VoiceSection; summary: string }
  /** A detail is missing (which feed, which diaper): open that form. */
  | { kind: "open-form"; type: CareLogType; summary: string }
  /** Understood, but a number is out of range. */
  | { kind: "invalid"; message: string }
  | { kind: "unknown" };

/** Sentences to show as examples (and to tap instead of speaking). */
export const VOICE_EXAMPLES = ["120 ml bottle", "Wet diaper", "She fell asleep", "Left side for 15 minutes", "Open vaccines"];

// ---------------------------------------------------------------- words

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const isNumberWord = (w: string | undefined) => w !== undefined && (w in SMALL || w in TENS);

/** Lower case, spelled-out numbers as digits ("one hundred and twenty" ->
 * 120, "forty five" -> 45, "at three thirty" -> "at 3:30", "half an hour"
 * -> "30 minutes"), and "p.m." as "pm". Padded with spaces for \b tests. */
export function normalize(text: string): string {
  let s = text.toLowerCase().replace(/[’]/g, "'");
  s = s.replace(/\b([ap])\.? ?m\b\.?/g, "$1m");
  s = s.replace(/[^a-z0-9.:' ]+/g, " ");
  s = s.replace(/\b(a|an|one) and a half hours?\b/g, "90 minutes");
  s = s.replace(/\bhalf an? hour\b/g, "30 minutes").replace(/\ba quarter of an hour\b/g, "15 minutes");
  s = s.replace(/\ban? hundred\b/g, "one hundred").replace(/\ban? (hour|minute)\b/g, "1 $1");

  const words = s.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    if (!isNumberWord(words[i])) {
      out.push(words[i]);
      i++;
      continue;
    }
    // Spoken clock time: "at three thirty", "at ten fifteen".
    const hour = SMALL[words[i]];
    if (out.at(-1) === "at" && hour >= 1 && hour <= 12 && isNumberWord(words[i + 1])) {
      let j = i + 1;
      let minute = 0;
      if (words[j] in TENS) minute += TENS[words[j++]];
      if (minute && words[j] in SMALL && SMALL[words[j]] < 10) minute += SMALL[words[j++]];
      else if (!minute && SMALL[words[j]] >= 10) minute += SMALL[words[j++]];
      if (minute) {
        out.push(`${hour}:${String(minute).padStart(2, "0")}`);
        i = j;
        continue;
      }
    }
    // A plain number: "one hundred and twenty", "forty five".
    let value = 0;
    let j = i;
    while (j < words.length) {
      const w = words[j];
      if (w in TENS) value += TENS[w];
      else if (w in SMALL) value += SMALL[w];
      else if (w === "hundred") value = (value || 1) * 100;
      else if (w === "and" && value >= 100 && isNumberWord(words[j + 1])) {
        /* "one hundred and twenty" */
      } else break;
      j++;
    }
    out.push(String(value));
    i = j;
  }
  // "4 and a half ounces" -> "4.5 ounces"
  return ` ${out.join(" ").replace(/\b(\d+) and a half\b/g, (_, n) => `${Number(n) + 0.5}`)} `;
}

const has = (s: string, re: RegExp) => re.test(s);

// ----------------------------------------------------------------- time

/** A time said in the sentence ("at 3 pm", "at 15:30", "20 minutes ago"),
 * or null. A clock time later than now is taken as yesterday. */
export function spokenTime(s: string, now: Date): Date | null {
  const ago = s.match(/\b(\d+(?:\.\d+)?) ?(minutes?|mins?|hours?|hrs?) ago\b/);
  if (ago) {
    const minutes = Number(ago[1]) * (/^h/.test(ago[2]) ? 60 : 1);
    return new Date(now.getTime() - minutes * 60_000);
  }
  const at = s.match(/\bat (\d{1,2})(?:[:. ](\d{2}))? ?(am|pm|a m|p m|in the morning|in the afternoon|in the evening|at night)?\b/);
  if (!at) return null;
  let hour = Number(at[1]);
  const minute = at[2] ? Number(at[2]) : 0;
  if (hour > 23 || minute > 59) return null;
  const half = at[3] ?? "";
  if (/^(pm|p m|in the afternoon|in the evening|at night)$/.test(half) && hour < 12) hour += 12;
  if (/^(am|a m|in the morning)$/.test(half) && hour === 12) hour = 0;
  const when = new Date(now);
  when.setHours(hour, minute, 0, 0);
  // "at 9" with no am/pm: the most recent 9 o'clock.
  if (!half && hour < 12) {
    const pm = new Date(when.getTime() + 12 * 3_600_000);
    if (pm.getTime() <= now.getTime() + LIMITS.futureToleranceMs) return pm;
  }
  if (when.getTime() > now.getTime() + LIMITS.futureToleranceMs) when.setDate(when.getDate() - 1);
  return when;
}

/** A length of time in minutes ("1 hour 20 minutes", "45 min", "2 hours"). */
export function spokenMinutes(s: string): number | null {
  const withoutAgo = s.replace(/\b\d+(?:\.\d+)? ?(minutes?|mins?|hours?|hrs?) ago\b/g, " ");
  const hours = withoutAgo.match(/\b(\d+(?:\.\d+)?) ?(hours?|hrs?|h)\b/);
  const minutes = withoutAgo.match(/\b(\d+) ?(minutes?|mins?|m)\b/);
  if (!hours && !minutes) return null;
  return Math.round((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
}

function clock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function lengthText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

// --------------------------------------------------------------- parse

const SECTIONS: [VoiceSection, RegExp, string][] = [
  ["history", /\b(history|timeline|entries|log book)\b/, "History"],
  ["insights", /\b(insights?|charts?|stats|statistics|averages?|trends?)\b/, "Insights"],
  ["vaccines", /\b(vaccines?|vaccinations?|shots?|immuni[sz]ations?)\b/, "Vaccines"],
  ["growth", /\b(growth|weight chart|percentiles?)\b/, "Growth"],
  ["appointments", /\b(appointments?|doctor|pediatrician|paediatrician|bookings?|check ?ups?)\b/, "Appointments"],
  ["wellbeing", /\b(wellbeing|well being|mental health|check in|support lines?)\b/, "Wellbeing"],
  ["help-board", /\b(help board|help requests?|helpers?)\b/, "Help board"],
  ["home", /\b(home|dashboard|start page)\b/, "Home"],
  ["log", /\b(log page|log form|logging page)\b/, "Log"],
];

/** The single action a sentence asks for. `unit` is the family's volume
 * unit, used when an amount has no unit ("bottle of 4"). */
export function parseVoiceCommand(text: string, now: Date = new Date(), unit: VolumeUnit = "ml"): VoiceIntent {
  const s = normalize(text);
  if (!s.trim()) return { kind: "unknown" };

  // Opening a page: "open vaccines", "show me the history", "go home".
  if (has(s, /\b(open|show|go to|go|take me to|see|view|check)\b/)) {
    for (const [section, re, label] of SECTIONS) {
      if (re.test(s)) return { kind: "navigate", section, summary: `Opening ${label}` };
    }
  }

  const when = spokenTime(s, now);
  const at = (payload: Record<string, unknown>) => {
    if (when) payload.occurred_at = when.toISOString();
    return payload;
  };
  const timeText = when ? `, ${clock(when)}` : "";

  // Medicine first: "gave tylenol 2.5 ml" mentions ml but isn't a bottle.
  if (has(s, /\b(medicine|medication|meds|tylenol|paracetamol|acetaminophen|ibuprofen|motrin|calpol|vitamin|drops|dose|antibiotics?|gripe water|gas drops|simethicone)\b/)) {
    const notes = text.trim().replace(/^(log|add|record|note)\s+/i, "").slice(0, LIMITS.notesMax);
    const label = notes.charAt(0).toUpperCase() + notes.slice(1);
    return { kind: "log", type: "medication", payload: at({ type: "medication", notes: label }), summary: `Medicine: ${label}${timeText}` };
  }

  // Sleep timer.
  if (has(s, /\b(woke up|woken up|is awake|she's awake|he's awake|they're awake|awake now|wake up|stop (the )?(sleep|nap)|stopped (the )?(sleep|nap)|(sleep|nap) (ended|is over|over|done)|end (the )?(sleep|nap)|finish(ed)? (the )?(sleep|nap))\b/)) {
    return { kind: "sleep-stop", endedAt: when?.toISOString() ?? null, summary: `Stop the sleep timer${timeText}` };
  }
  const minutes = spokenMinutes(s);
  const sleepWord = has(s, /\b(sleep|slept|nap|napped|napping|asleep|sleeping)\b/);
  if (sleepWord && minutes !== null && has(s, /\b(slept|napped|nap|sleep)\b/) && !has(s, /\b(fell asleep|start)\b/)) {
    if (minutes < 1 || minutes > LIMITS.sleepMaxMin) return { kind: "invalid", message: "A sleep must be between 1 minute and 24 hours." };
    const ended = when ?? now;
    const started = new Date(ended.getTime() - minutes * 60_000);
    return {
      kind: "log",
      type: "sleep",
      payload: { type: "sleep", occurred_at: started.toISOString(), ended_at: ended.toISOString() },
      summary: `Sleep, ${lengthText(minutes)}${when ? `, until ${clock(when)}` : ""}`,
    };
  }
  if (sleepWord || has(s, /\b(went down|down for a nap|bedtime|bed time)\b/)) {
    return { kind: "sleep-start", startedAt: when?.toISOString() ?? null, summary: `Start the sleep timer${timeText}` };
  }

  // Diapers.
  const wet = has(s, /\b(wet|pee|peed|wee|weed|urine)\b/);
  const dirty = has(s, /\b(dirty|poop|pooped|poo|pooed|poopy|soiled|bm|stool|messy)\b/);
  if (wet || dirty || has(s, /\b(diaper|diapers|nappy|nappies)\b/)) {
    let kind: DiaperKind | null = null;
    if (has(s, /\bboth\b/) || (wet && dirty)) kind = "both";
    else if (dirty) kind = "dirty";
    else if (wet) kind = "wet";
    if (!kind) return { kind: "open-form", type: "diaper", summary: "Wet, dirty or both? Opening the diaper form" };
    const title = { wet: "Wet diaper", dirty: "Dirty diaper", both: "Wet and dirty diaper" }[kind];
    return { kind: "log", type: "diaper", payload: at({ type: "diaper", diaper_kind: kind }), summary: `${title}${timeText}` };
  }

  // Feeds.
  const breast = !has(s, /\bbottle\b/) && has(s, /\b(breast|breastfed|breastfeed|breastfeeding|nursed|nursing|nurse|latched|left side|right side|both sides|left breast|right breast)\b/);
  const solid = has(s, /\b(solids?|puree|pur[eé]e|cereal|porridge|ate|eaten|food|mashed|banana|avocado|sweet potato|carrots?|apple sauce|applesauce|yogurt|yoghurt|oatmeal)\b/);
  const amount = s.match(/\b(\d+(?:\.\d+)?) ?(ml|mls|milliliters?|millilitres?|mil|oz|ounces?|ounce)\b/);
  const bareAmount = s.match(/\b(?:bottle|formula|pumped milk|expressed milk|milk)\b[^0-9]*?\b(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?)\b[^0-9]*?\b(?:bottle|formula)\b/);
  const bottle = has(s, /\b(bottle|formula|pumped|expressed|milk)\b/) || Boolean(amount);
  const fed = has(s, /\b(fed|feed|feeding|ate|drank|had)\b/);

  if (breast) {
    const side: FeedSide | null = has(s, /\bboth\b/) ? "both" : has(s, /\bleft\b/) ? "left" : has(s, /\bright\b/) ? "right" : null;
    if (minutes !== null && (minutes < LIMITS.feedMin.min || minutes > LIMITS.feedMin.max)) {
      return { kind: "invalid", message: `A feed must be between ${LIMITS.feedMin.min} and ${LIMITS.feedMin.max} minutes.` };
    }
    const payload = at({ type: "feed", feed_type: "breast" });
    if (side) payload.side = side;
    if (minutes !== null) payload.duration_min = minutes;
    const parts = ["Breast feed", side ? (side === "both" ? "both sides" : `${side} side`) : null, minutes !== null ? `${minutes} min` : null];
    return { kind: "log", type: "feed", payload, summary: `${parts.filter(Boolean).join(", ")}${timeText}` };
  }

  if (bottle || solid) {
    let ml: number | null = null;
    if (amount) {
      ml = /^(oz|ounce)/.test(amount[2]) ? Math.round(Number(amount[1]) * ML_PER_OZ) : Math.round(Number(amount[1]));
    } else if (bareAmount && !solid) {
      const n = Number(bareAmount[1] ?? bareAmount[2]);
      ml = unit === "oz" ? Math.round(n * ML_PER_OZ) : Math.round(n);
    }
    if (ml !== null && (ml < LIMITS.amountMl.min || ml > LIMITS.amountMl.max)) {
      return { kind: "invalid", message: `The amount must be between ${LIMITS.amountMl.min} and ${LIMITS.amountMl.max} ml.` };
    }
    const feedType = solid && !has(s, /\b(bottle|formula)\b/) ? "solid" : "bottle";
    const payload = at({ type: "feed", feed_type: feedType });
    if (ml !== null) payload.amount_ml = ml;
    if (feedType === "bottle" && minutes !== null && minutes >= LIMITS.feedMin.min && minutes <= LIMITS.feedMin.max) {
      payload.duration_min = minutes;
    }
    const label = feedType === "solid" ? "Solids" : "Bottle";
    return { kind: "log", type: "feed", payload, summary: `${label}${ml !== null ? `, ${ml} ml` : ""}${timeText}` };
  }

  if (fed) return { kind: "open-form", type: "feed", summary: "Breast, bottle or solids? Opening the feed form" };

  // "Log" on its own, or "open log".
  if (has(s, /\b(log|add|record)\b/)) return { kind: "navigate", section: "log", summary: "Opening Log" };
  return { kind: "unknown" };
}
