// Pure helpers for the Growth page (no React), so they can be unit-tested.

const DAYS_PER_MONTH = 365.25 / 12;

/** Age in fractional months on `onDate` -- where a measurement sits on the
 * chart's x-axis. (The server's percentile uses completed months, as WHO's
 * monthly tables require; the dot is plotted at the exact age.) */
export function ageInMonths(birthDate: string, onDate: string): number {
  const ms = Date.parse(`${onDate}T00:00:00Z`) - Date.parse(`${birthDate}T00:00:00Z`);
  return Math.round((ms / 86_400_000 / DAYS_PER_MONTH) * 100) / 100;
}

/** "about 62 in 100" style phrasing of a percentile, for parents. */
export function comparedToPeers(
  percentile: number,
  measure: "weight" | "length",
  sex: string
): string {
  const peers = `${sex === "male" ? "boys" : sex === "female" ? "girls" : "babies"} the same age`;
  const more = measure === "weight" ? "heavier" : "longer";
  const less = measure === "weight" ? "lighter" : "shorter";
  if (percentile < 1) return `${less} than almost all ${peers}`;
  if (percentile > 99) return `${more} than almost all ${peers}`;
  const n = Math.round(percentile);
  if (n === 50) return `right on the average for ${peers}`;
  return n > 50
    ? `${more} than about ${n} in 100 ${peers}`
    : `${less} than about ${100 - n} in 100 ${peers}`;
}

/** Whether a percentile is outside the band most babies fall in (3rd-97th,
 * the outer lines on WHO's charts) -- worth mentioning to a clinician. */
export function outsideTypicalRange(percentile: number): boolean {
  return percentile < 3 || percentile > 97;
}
