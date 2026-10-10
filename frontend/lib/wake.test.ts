// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { AWAKE_FOR_MS, createWaker, WAKE_BUDGET_MS, WAKE_RETRY_MS } from "./wake.ts";

/** A fake clock that waiting moves forward, and a ping that answers each
 * given result in turn (true = healthy, false = not yet, Error = no answer). */
function setup(results: (boolean | Error)[]) {
  let time = 0;
  let pings = 0;
  const waker = createWaker({
    ping: async () => {
      const r = results[Math.min(pings++, results.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
    now: () => time,
    wait: async (ms) => {
      time += ms;
    },
  });
  return { ...waker, pings: () => pings, advance: (ms: number) => (time += ms) };
}

test("keeps pinging through a cold start until the server answers", async () => {
  const w = setup([new TypeError("Failed to fetch"), false, false, true]);
  assert.equal(await w.wake(), true);
  assert.equal(w.pings(), 4);
  assert.equal(w.isAwake(), true);
});

test("once awake, waking again is instant until the awake window ends", async () => {
  const w = setup([true]);
  await w.wake();
  await w.wake();
  assert.equal(w.pings(), 1);
  w.advance(AWAKE_FOR_MS);
  assert.equal(w.isAwake(), false);
  await w.wake();
  assert.equal(w.pings(), 2);
});

test("calls made during a ping share it", async () => {
  const w = setup([true]);
  const [a, b] = await Promise.all([w.wake(), w.wake()]);
  assert.deepEqual([a, b], [true, true]);
  assert.equal(w.pings(), 1);
});

test("gives up after the time budget, and a later call tries again", async () => {
  const w = setup([new TypeError("Failed to fetch")]);
  assert.equal(await w.wake(), false);
  assert.equal(w.pings(), Math.ceil(WAKE_BUDGET_MS / WAKE_RETRY_MS));
  assert.equal(w.isAwake(), false);
  await w.wake();
  assert.ok(w.pings() > Math.ceil(WAKE_BUDGET_MS / WAKE_RETRY_MS));
});

test("a reply to any request counts as awake", async () => {
  const w = setup([true]);
  w.markAwake();
  assert.equal(await w.wake(), true);
  assert.equal(w.pings(), 0);
});
