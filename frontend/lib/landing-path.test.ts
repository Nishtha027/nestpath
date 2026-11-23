// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// The landing page's winding path: the route goes through every feature's
// node, swings out only in the gaps, and only ever heads down the page, so
// a scroll position maps to exactly one point for the walking chick.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoute, lengthAtY, pointAtLength, smoothPath, type Sample } from "./landing-path.ts";

const stops = [
  { x: 500, y: 500, top: 300, bottom: 700 },
  { x: 500, y: 1100, top: 900, bottom: 1300 },
  { x: 500, y: 1700, top: 1500, bottom: 1900 },
];

test("the route visits every node and only heads down", () => {
  const route = buildRoute({ x: 500, y: 0 }, stops, { x: 500, y: 2200 }, 200);
  for (const stop of stops) assert.ok(route.some((p) => p.x === stop.x && p.y === stop.y), `misses ${stop.y}`);
  for (let i = 1; i < route.length; i++) assert.ok(route[i].y > route[i - 1].y, `y goes back at ${i}`);
  assert.deepEqual(route[0], { x: 500, y: 0 });
  assert.deepEqual(route.at(-1), { x: 500, y: 2200 });
});

test("it swings out in the gaps, to alternating sides, never beside content", () => {
  const route = buildRoute({ x: 500, y: 0 }, stops, { x: 500, y: 2200 }, 200);
  const swings = route.filter((p) => p.x !== 500);
  assert.deepEqual(
    swings.map((p) => p.x),
    [700, 300, 700, 300]
  );
  for (const p of swings) {
    const beside = stops.some((s) => p.y >= s.top && p.y <= s.bottom);
    assert.ok(!beside, `swing at y=${p.y} sits beside a feature`);
  }
});

test("points that would be level are dropped", () => {
  const route = buildRoute({ x: 0, y: 0 }, [{ x: 0, y: 0, top: 0, bottom: 0 }], { x: 0, y: 10 }, 50);
  for (let i = 1; i < route.length; i++) assert.ok(route[i].y > route[i - 1].y);
});

test("the smooth path's control points never turn back upwards", () => {
  const route = buildRoute({ x: 500, y: 0 }, stops, { x: 500, y: 2200 }, 300);
  const d = smoothPath(route);
  assert.match(d, /^M500 0 C/);
  const ys = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
  // Every cubic's points (start, two controls, end) are in order of y.
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1], `y decreases at ${i}: ${ys[i - 1]} -> ${ys[i]}`);
});

test("lengthAtY and pointAtLength interpolate between samples", () => {
  const samples: Sample[] = [
    { len: 0, x: 0, y: 0 },
    { len: 100, x: 60, y: 80 },
    { len: 200, x: 60, y: 180 },
  ];
  assert.equal(lengthAtY(samples, -50), 0);
  assert.equal(lengthAtY(samples, 40), 50);
  assert.equal(lengthAtY(samples, 130), 150);
  assert.equal(lengthAtY(samples, 999), 200);
  assert.deepEqual(pointAtLength(samples, 50), { x: 30, y: 40 });
  assert.deepEqual(pointAtLength(samples, 250), { x: 60, y: 180 });
  assert.equal(lengthAtY([], 10), 0);
});
