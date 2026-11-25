// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// The voice assistant's sentence parser: what parents actually say, in the
// words speech recognition actually returns (digits or spelled out).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, parseVoiceCommand, spokenMinutes, spokenTime, type VoiceIntent } from "./voice-intent.ts";

// Tue Nov 24 2026, 4:00 pm local time.
const NOW = new Date(2026, 10, 24, 16, 0, 0);
const parse = (text: string, unit: "ml" | "oz" = "ml") => parseVoiceCommand(text, NOW, unit);
const payload = (intent: VoiceIntent) => {
  assert.equal(intent.kind, "log", JSON.stringify(intent));
  return (intent as Extract<VoiceIntent, { kind: "log" }>).payload;
};

test("spelled-out numbers and clock times become digits", () => {
  assert.equal(normalize("one hundred and twenty ml").trim(), "120 ml");
  assert.equal(normalize("forty five minutes").trim(), "45 minutes");
  assert.equal(normalize("a hundred ml").trim(), "100 ml");
  assert.equal(normalize("at three thirty P.M.").trim(), "at 3:30 pm");
  assert.equal(normalize("half an hour ago").trim(), "30 minutes ago");
  assert.equal(normalize("4 and a half ounces").trim(), "4.5 ounces");
});

test("times: clock times, 'ago', and a later clock time means yesterday", () => {
  assert.equal(spokenTime(" at 3 pm ", NOW)?.getHours(), 15);
  assert.equal(spokenTime(" at 3:30 pm ", NOW)?.getMinutes(), 30);
  assert.equal(spokenTime(" 20 minutes ago ", NOW)?.getTime(), NOW.getTime() - 20 * 60_000);
  assert.equal(spokenTime(" 2 hours ago ", NOW)?.getHours(), 14);
  const late = spokenTime(" at 9 pm ", NOW)!;
  assert.equal(late.getDate(), 23, "9 pm hasn't happened yet today");
  assert.equal(spokenTime(" at 3 ", NOW)?.getHours(), 15, "no am/pm: the most recent 3 o'clock");
  assert.equal(spokenTime(" just now ", NOW), null);
  assert.equal(spokenMinutes(" 1 hour 20 minutes "), 80);
  assert.equal(spokenMinutes(" 45 min "), 45);
  assert.equal(spokenMinutes(" 20 minutes ago "), null, "'ago' is a time, not a length");
});

test("bottles: amounts in ml or oz, and a bare number uses the family's unit", () => {
  assert.deepEqual(payload(parse("120 ml bottle")), { type: "feed", feed_type: "bottle", amount_ml: 120 });
  assert.equal(payload(parse("She had a bottle of 4 ounces")).amount_ml, 118);
  assert.equal(payload(parse("bottle 90")).amount_ml, 90);
  assert.equal(payload(parse("bottle 4", "oz")).amount_ml, 118);
  assert.equal(payload(parse("one hundred and twenty mls of formula")).amount_ml, 120);
  assert.equal(payload(parse("breast milk in a bottle, 80 ml")).feed_type, "bottle");
  assert.equal(parse("120 ml bottle").kind === "log" && (parse("120 ml bottle") as { summary: string }).summary, "Bottle, 120 ml");
});

test("breast feeds: side and length", () => {
  assert.deepEqual(payload(parse("Breastfed on the left side for 15 minutes")), {
    type: "feed",
    feed_type: "breast",
    side: "left",
    duration_min: 15,
  });
  assert.equal(payload(parse("nursed both sides twenty minutes")).side, "both");
  assert.equal(payload(parse("right side")).side, "right");
});

test("solids", () => {
  assert.equal(payload(parse("She ate some banana puree")).feed_type, "solid");
  assert.equal(payload(parse("solids 50 ml")).amount_ml, 50);
});

test("diapers: wet, dirty, both, and the plain word asks which", () => {
  assert.deepEqual(payload(parse("Wet diaper")), { type: "diaper", diaper_kind: "wet" });
  assert.equal(payload(parse("he pooped")).diaper_kind, "dirty");
  assert.equal(payload(parse("wet and dirty nappy")).diaper_kind, "both");
  assert.equal(payload(parse("changed a poopy diaper, it was wet too")).diaper_kind, "both");
  assert.deepEqual(parse("changed her diaper"), { kind: "open-form", type: "diaper", summary: "Wet, dirty or both? Opening the diaper form" });
});

test("a time said in the sentence is sent as occurred_at", () => {
  const p = payload(parse("wet diaper 20 minutes ago"));
  assert.equal(p.occurred_at, new Date(NOW.getTime() - 20 * 60_000).toISOString());
  assert.equal(new Date(payload(parse("bottle 100 ml at 2:15 pm")).occurred_at as string).getHours(), 14);
});

test("sleep: start, stop, and a past sleep with its length", () => {
  assert.equal(parse("She fell asleep").kind, "sleep-start");
  assert.equal(parse("he's down for a nap").kind, "sleep-start");
  assert.equal(parse("start the sleep timer").kind, "sleep-start");
  const earlier = parse("she fell asleep 10 minutes ago");
  assert.equal(earlier.kind === "sleep-start" && earlier.startedAt, new Date(NOW.getTime() - 10 * 60_000).toISOString());
  assert.equal(parse("She woke up").kind, "sleep-stop");
  assert.equal(parse("stop the nap").kind, "sleep-stop");
  const nap = payload(parse("She napped for 1 hour and 20 minutes"));
  assert.equal(nap.type, "sleep");
  assert.equal(nap.ended_at, NOW.toISOString());
  assert.equal(nap.occurred_at, new Date(NOW.getTime() - 80 * 60_000).toISOString());
});

test("medicine keeps what was said as the note", () => {
  const p = payload(parse("Gave Tylenol 2.5 ml"));
  assert.equal(p.type, "medication");
  assert.equal(p.notes, "Gave Tylenol 2.5 ml");
  assert.ok(!("amount_ml" in p), "a dose is not a bottle");
});

test("opening pages", () => {
  const section = (text: string) => {
    const intent = parse(text);
    return intent.kind === "navigate" ? intent.section : intent.kind;
  };
  assert.equal(section("Open vaccines"), "vaccines");
  assert.equal(section("show me the history"), "history");
  assert.equal(section("take me to growth"), "growth");
  assert.equal(section("go home"), "home");
  assert.equal(section("open the help board"), "help-board");
  assert.equal(section("I want to see the doctor"), "appointments");
  assert.equal(section("go to sleep"), "sleep-start", "not a page");
});

test("out-of-range numbers and unclear sentences", () => {
  assert.equal(parse("bottle of 900 ml").kind, "invalid");
  assert.equal(parse("breastfed for 300 minutes").kind, "invalid");
  assert.equal(parse("she fed").kind, "open-form");
  assert.equal(parse("what's the weather").kind, "unknown");
  assert.equal(parse("   ").kind, "unknown");
});
