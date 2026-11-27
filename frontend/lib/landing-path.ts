// The path that winds down the landing page's feature section, with the
// chick walking along it (app/landing/FeaturePath.tsx). Plain geometry, so
// it is tested directly (lib/landing-path.test.ts); the component measures
// the page and samples the SVG path, these functions do the maths.

export type Point = { x: number; y: number };

/** Where each feature sits: its node (the icon on the path, x and y) and
 * the top and bottom edges of its content. All in px, relative to the
 * section. */
export type Stop = { x: number; y: number; top: number; bottom: number };

/** One sample along the drawn path: distance from the start, and where. */
export type Sample = { len: number; x: number; y: number };

const round = (n: number) => Math.round(n * 10) / 10;

/** The route the path takes: from the start, through every stop's node, to
 * the end. Between two features it swings out to alternate sides by
 * `swing` px (into the empty gap, away from the content), and it runs
 * straight down through each feature so it never crosses the text. y only
 * ever increases, so a scroll position maps to exactly one place. */
export function buildRoute(start: Point, stops: Stop[], end: Point, swing: number): Point[] {
  const route: Point[] = [start];
  let prevBottom = start.y;
  let prevX = start.x;
  stops.forEach((stop, i) => {
    const top = Math.min(stop.top, stop.y);
    if (top - prevBottom > 40) {
      const side = i % 2 === 0 ? 1 : -1;
      route.push({ x: (prevX + stop.x) / 2 + side * swing, y: (prevBottom + top) / 2 });
    }
    if (stop.y - top > 40) route.push({ x: stop.x, y: top });
    route.push({ x: stop.x, y: stop.y });
    if (stop.bottom > stop.y + 40) route.push({ x: stop.x, y: stop.bottom });
    prevBottom = Math.max(stop.y, stop.bottom);
    prevX = stop.x;
  });
  if (end.y - prevBottom > 40) {
    const side = stops.length % 2 === 0 ? 1 : -1;
    route.push({ x: (prevX + end.x) / 2 + side * swing, y: (prevBottom + end.y) / 2 });
  }
  route.push(end);

  // Keep y strictly increasing (a layout can put two points level).
  const out: Point[] = [];
  for (const p of route) if (out.length === 0 || p.y > out[out.length - 1].y + 1) out.push(p);
  return out;
}

/** A smooth SVG path through the points: Catmull-Rom turned into cubic
 * Béziers. The control points are clamped so each piece keeps moving
 * downwards (y never doubles back), which keeps lengthAtY single-valued. */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  let d = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const half = (p2.y - p1.y) / 2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: Math.min(p1.y + (p2.y - p0.y) / 6, p1.y + half) };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: Math.max(p2.y - (p3.y - p1.y) / 6, p2.y - half) };
    d += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

/** How far along the path (in px of length) it reaches height y.
 * Samples are in order of length, with y increasing. */
export function lengthAtY(samples: Sample[], y: number): number {
  if (samples.length === 0) return 0;
  if (y <= samples[0].y) return samples[0].len;
  const last = samples[samples.length - 1];
  if (y >= last.y) return last.len;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].y <= y) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
  return a.len + (b.len - a.len) * t;
}

/** The point at a given length, between the two nearest samples. */
export function pointAtLength(samples: Sample[], len: number): Point {
  if (samples.length === 0) return { x: 0, y: 0 };
  if (len <= samples[0].len) return { x: samples[0].x, y: samples[0].y };
  const last = samples[samples.length - 1];
  if (len >= last.len) return { x: last.x, y: last.y };
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].len <= len) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = (len - a.len) / (b.len - a.len);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
