// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { BAND_TEXT, needHelpText, nextCheckIn, resultSections, toolkitOrder } from "./wellbeing.ts";

// Shape of the server's POST /screenings response for a total score of 1
// with item 10 answered "Hardly ever" (see backend tests/test_screening.py).
const lowTotalItem10Positive = {
  total_score: 1,
  score_band: "low" as const,
  risk_level: "high",
  item_10_flag: true,
};

test("low total with item 10 positive puts crisis support first", () => {
  const sections = resultSections(lowTotalItem10Positive);
  assert.equal(sections[0], "crisis");
  assert.ok(sections.indexOf("crisis") < sections.indexOf("toolkit"));
});

test("a low total with item 10 flagged never shows the low-band reassurance", () => {
  const text = needHelpText(lowTotalItem10Positive);
  assert.notEqual(text.headline, BAND_TEXT.low.headline);
  assert.doesNotMatch(text.headline, /don't suggest/i);
  assert.equal(text.suggestAppointment, true);
  assert.equal(needHelpText({ ...lowTotalItem10Positive, item_10_flag: false }), BAND_TEXT.low);
});

test("crisis support follows the server flag only, not the band", () => {
  for (const band of ["low", "moderate", "high"] as const) {
    assert.equal(resultSections({ item_10_flag: true })[0], "crisis", band);
    assert.ok(!resultSections({ item_10_flag: false }).includes("crisis"), band);
  }
});

test("without the flag, the help recommendation comes first", () => {
  assert.deepEqual(resultSections({ item_10_flag: false }), ["needHelp", "toolkit", "supportLines"]);
});

test("only the highest band suggests booking an appointment", () => {
  assert.equal(BAND_TEXT.low.suggestAppointment, false);
  assert.equal(BAND_TEXT.moderate.suggestAppointment, false);
  assert.equal(BAND_TEXT.high.suggestAppointment, true);
});

test("band text never presents the result as a diagnosis", () => {
  for (const text of Object.values(BAND_TEXT)) {
    assert.doesNotMatch(`${text.headline} ${text.detail}`, /you have|diagnosed with|you are depressed/i);
  }
});

test("every band gets the full toolkit", () => {
  for (const band of ["low", "moderate", "high"] as const) {
    assert.equal(new Set(toolkitOrder(band)).size, 5);
  }
});

test("check-in is due 14 days after the last result", () => {
  const last = "2026-10-01T09:00:00Z";
  assert.equal(nextCheckIn(last, new Date("2026-10-14T09:00:00Z")).isDue, false);
  assert.equal(nextCheckIn(last, new Date("2026-10-15T09:00:00Z")).isDue, true);
});
