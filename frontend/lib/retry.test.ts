// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetryable, loadErrorMessage, WAKING_UP_MESSAGE, withRetry } from "./retry.ts";

// Shaped like ApiError in api.ts (a status on an Error).
function httpError(status: number, message = `status ${status}`) {
  return Object.assign(new Error(message), { status });
}
const networkError = () => new TypeError("Failed to fetch");

/** A load that fails with each given error in turn, then succeeds. */
function flaky(errors: unknown[]) {
  let calls = 0;
  const load = async () => {
    calls++;
    if (calls <= errors.length) throw errors[calls - 1];
    return "ok";
  };
  return { load, calls: () => calls };
}

const waits: number[] = [];
const fakeWait = async (ms: number) => {
  waits.push(ms);
};

test("network errors and 5xx are retryable; 4xx are not", () => {
  assert.equal(isRetryable(networkError()), true);
  for (const s of [500, 502, 503, 504]) assert.equal(isRetryable(httpError(s)), true);
  for (const s of [400, 401, 403, 404, 422]) assert.equal(isRetryable(httpError(s)), false);
  assert.equal(isRetryable(new Error("something else")), false);
});

test("retries a 5xx, then succeeds", async () => {
  waits.length = 0;
  const f = flaky([httpError(503)]);
  assert.equal(await withRetry(f.load, { delaysMs: [10, 20], wait: fakeWait }), "ok");
  assert.equal(f.calls(), 2);
  assert.deepEqual(waits, [10]);
});

test("retries a network error, then succeeds", async () => {
  waits.length = 0;
  const f = flaky([networkError(), networkError()]);
  assert.equal(await withRetry(f.load, { delaysMs: [10, 20], wait: fakeWait }), "ok");
  assert.equal(f.calls(), 3);
  assert.deepEqual(waits, [10, 20]);
});

test("gives up after the last retry with the last error", async () => {
  const last = httpError(502);
  const f = flaky([httpError(500), httpError(503), last, httpError(500)]);
  await assert.rejects(withRetry(f.load, { delaysMs: [1, 1], wait: fakeWait }), (err) => err === last);
  assert.equal(f.calls(), 3);
});

test("never retries a 4xx (including 401)", async () => {
  for (const status of [401, 404]) {
    waits.length = 0;
    const err = httpError(status);
    const f = flaky([err]);
    await assert.rejects(withRetry(f.load, { delaysMs: [1, 1], wait: fakeWait }), (e) => e === err);
    assert.equal(f.calls(), 1);
    assert.deepEqual(waits, []);
  }
});

test("final message: friendly for retryable failures, the server's for others", () => {
  assert.equal(loadErrorMessage(httpError(503), "fallback"), WAKING_UP_MESSAGE);
  assert.equal(loadErrorMessage(networkError(), "fallback"), WAKING_UP_MESSAGE);
  assert.equal(loadErrorMessage(httpError(404, "Family not found"), "fallback"), "Family not found");
  assert.equal(loadErrorMessage("weird", "fallback"), "fallback");
});
