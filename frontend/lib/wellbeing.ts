// Wellbeing-tab presentation logic. Deliberately free of imports (other
// than types) so Node's built-in test runner can load it directly.
//
// This module does NOT decide who needs crisis support: that is the
// server's item_10_flag (backend/reference-data/epds_screening.py), passed
// through as-is. It only maps the server's score_band to plain-language
// text and decides the order the result sections render in.

import type { ScoreBand } from "./types";

export type BandText = {
  label: string;
  headline: string;
  detail: string;
  suggestAppointment: boolean;
};

export const BAND_TEXT: Record<ScoreBand, BandText> = {
  low: {
    label: "lower range (0-9)",
    headline: "Your answers don't suggest you need extra support right now.",
    detail: "You can still talk to someone you trust or a provider, any time.",
    suggestAppointment: false,
  },
  moderate: {
    label: "middle range (10-12)",
    headline: "Worth talking to someone you trust or a provider.",
    detail:
      "Feelings like these are common after a baby arrives. Checking in again in about two weeks can show whether things are easing.",
    suggestAppointment: false,
  },
  high: {
    label: "higher range (13+)",
    headline: "We suggest speaking with a provider soon.",
    detail: "They can talk through how you've been feeling and what might help.",
    suggestAppointment: true,
  },
};

/** Replaces the band's text when the server flagged item 10: a low total
 * must never read as "you don't need extra support" next to crisis
 * support. */
export const ITEM_10_TEXT: BandText = {
  label: "",
  headline: "Please talk to someone today.",
  detail:
    "Because of your answer about thoughts of harming yourself, reach out today, whatever your total score: the crisis line above, a provider, or someone you trust.",
  suggestAppointment: true,
};

/** The "Do you need help?" text. Follows the server's item_10_flag; it does
 * not recompute it. */
export function needHelpText(result: { item_10_flag: boolean; score_band: ScoreBand }): BandText {
  return result.item_10_flag ? ITEM_10_TEXT : BAND_TEXT[result.score_band];
}

export type ResultSection = "crisis" | "needHelp" | "toolkit" | "supportLines";

/** Render order for a result. Crisis support comes first, above everything
 * else, whenever the server flagged item 10 -- regardless of total score
 * or band. */
export function resultSections(result: { item_10_flag: boolean }): ResultSection[] {
  const rest: ResultSection[] = ["needHelp", "toolkit", "supportLines"];
  return result.item_10_flag ? ["crisis", ...rest] : rest;
}

export type ToolkitTool = "breathing" | "grounding" | "sleep" | "askForHelp" | "whenToCall";

/** Same tools for every band; the order puts the most relevant first. */
export function toolkitOrder(band: ScoreBand): ToolkitTool[] {
  if (band === "low") return ["breathing", "sleep", "grounding", "askForHelp", "whenToCall"];
  if (band === "moderate") return ["askForHelp", "breathing", "grounding", "sleep", "whenToCall"];
  return ["whenToCall", "askForHelp", "breathing", "grounding", "sleep"];
}

export const CHECK_IN_INTERVAL_DAYS = 14;

/** When to suggest the next check-in, from the latest result's timestamp. */
export function nextCheckIn(lastCreatedAt: string, now: Date = new Date()) {
  const due = new Date(new Date(lastCreatedAt).getTime() + CHECK_IN_INTERVAL_DAYS * 86_400_000);
  return { due, isDue: now.getTime() >= due.getTime() };
}
