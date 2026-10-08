// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageInMonths, comparedToPeers, outsideTypicalRange } from "./growth.ts";

test("age in months is fractional and starts at 0", () => {
  assert.equal(ageInMonths("2026-04-08", "2026-04-08"), 0);
  assert.equal(ageInMonths("2026-01-01", "2027-01-01"), 11.99); // 365 days
  assert.ok(Math.abs(ageInMonths("2026-04-08", "2026-10-08") - 6) < 0.05);
});

test("percentiles become plain-language comparisons", () => {
  assert.equal(comparedToPeers(62.4, "weight", "female"), "heavier than about 62 in 100 girls the same age");
  assert.equal(comparedToPeers(20, "length", "male"), "shorter than about 80 in 100 boys the same age");
  assert.equal(comparedToPeers(50.2, "weight", "male"), "right on the average for boys the same age");
  assert.equal(comparedToPeers(99.6, "length", "female"), "longer than almost all girls the same age");
});

test("outside 3rd-97th is flagged", () => {
  assert.equal(outsideTypicalRange(2.9), true);
  assert.equal(outsideTypicalRange(3), false);
  assert.equal(outsideTypicalRange(97.5), true);
});
