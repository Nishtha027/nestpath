// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// MotionGuard drops the idle loops only when frames are clearly too slow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { struggling } from "./motion-guard.ts";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const frames = (ms: number, count = 120) => Array<number>(count).fill(ms);

test("smooth screens keep the loops, at 60, 120 and 144 Hz", () => {
  assert.equal(struggling(frames(16.7)), false);
  assert.equal(struggling(frames(8.3, 240)), false);
  assert.equal(struggling(frames(6.9, 280)), false);
  // A few hiccups (a slow frame now and then) are fine.
  assert.equal(struggling([...frames(16.7, 110), ...frames(50, 10)]), false);
});

test("slow devices fall back to the entrances only", () => {
  // A steady 30 fps.
  assert.equal(struggling(frames(33.3, 60)), true);
  // Mostly fine, but one frame in four misses two refreshes.
  assert.equal(struggling([...frames(16.7, 75), ...frames(50, 25)]), true);
  // Hardly any frames at all in the sample.
  assert.equal(struggling(frames(250, 8)), true);
});

test("the guard is mounted on every page and drives the CSS classes", () => {
  assert.match(readFileSync(join(FRONTEND, "app", "layout.tsx"), "utf8"), /<MotionGuard \/>/);
  const guard = readFileSync(join(FRONTEND, "app", "MotionGuard.tsx"), "utf8");
  assert.match(guard, /classList\.toggle\("np-paused", document\.hidden\)/);
  assert.match(guard, /classList\.toggle\("np-lite", lite\)/);
  const css = readFileSync(join(FRONTEND, "app", "globals.css"), "utf8");
  assert.match(css, /\.np-paused \[class\*="np-loop-"\] \{\s*animation-play-state: paused;/);
  assert.match(css, /\.np-lite \[class\*="np-loop-"\] \{\s*animation: none;/);
});
