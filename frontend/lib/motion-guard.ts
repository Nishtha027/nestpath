// MotionGuard's frame-time check (app/MotionGuard.tsx). After the page has
// settled, it records the gaps between animation frames for a short while;
// if this device clearly can't keep up, the idle loops are dropped and only
// the one-off entrance animations remain.

/** Wait this long after the page opens (past the entrance animations). */
export const START_AFTER_MS = 1500;
/** Then sample frames for this long. */
export const SAMPLE_MS = 2000;
/** Remembered for the rest of the visit, so each page doesn't re-measure. */
export const MOTION_KEY = "nestpath-motion";

/** True when frame gaps (ms) show a struggling device: a typical frame
 * slower than ~40 fps, or more than one frame in five missing two
 * 60 Hz refreshes. Too few frames to judge counts as struggling too. */
export function struggling(gaps: number[]): boolean {
  if (gaps.length < 10) return true;
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const slow = gaps.filter((gap) => gap > 34).length / gaps.length;
  return median > 25 || slow > 0.2;
}
