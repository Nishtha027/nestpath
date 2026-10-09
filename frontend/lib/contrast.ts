// WCAG contrast checks for the design tokens in app/globals.css. The pairs
// below are every text/background and UI-component/background combination
// the app actually renders. Used by lib/contrast.test.ts (npm test) and
// scripts/contrast-report.ts (npm run contrast).

export const TEXT = 4.5; // normal text
export const NON_TEXT = 3; // UI components, graphics, focus rings

export type Pair = { fg: string; bg: string; min: number; use: string };

export const PAIRS: Pair[] = [
  // Body text
  { fg: "ink", bg: "page", min: TEXT, use: "body text on the page" },
  { fg: "ink", bg: "surface", min: TEXT, use: "text in cards" },
  { fg: "ink", bg: "pink-soft", min: TEXT, use: "screening note, child chip" },
  { fg: "ink", bg: "blue-soft", min: TEXT, use: "latest growth summary, selected answers" },
  { fg: "ink", bg: "danger-bg", min: TEXT, use: "alert rows" },
  { fg: "muted", bg: "page", min: TEXT, use: "secondary text on the page" },
  { fg: "muted", bg: "surface", min: TEXT, use: "secondary text in cards, chart axes" },
  { fg: "muted", bg: "pink-soft", min: TEXT, use: "secondary text on pink" },
  { fg: "muted", bg: "blue-soft", min: TEXT, use: "percentiles in growth summary" },
  { fg: "chart-axis", bg: "surface", min: TEXT, use: "chart axis labels" },
  // Actions
  { fg: "on-primary", bg: "primary", min: TEXT, use: "primary button" },
  { fg: "on-primary", bg: "primary-hover", min: TEXT, use: "primary button, hover" },
  { fg: "primary-ink", bg: "surface", min: TEXT, use: "links" },
  { fg: "primary-ink", bg: "page", min: TEXT, use: "links on the page" },
  { fg: "primary-ink", bg: "blue-soft", min: TEXT, use: "active tab, invite code, selected pill" },
  { fg: "secondary-ink", bg: "secondary-bg", min: TEXT, use: "secondary button" },
  { fg: "secondary-ink", bg: "secondary-hover", min: TEXT, use: "secondary button, hover" },
  // Status messages and vaccine group labels
  { fg: "danger-ink", bg: "danger-bg", min: TEXT, use: "error message" },
  { fg: "danger-ink", bg: "surface", min: TEXT, use: "live connection stopped" },
  { fg: "success-ink", bg: "success-bg", min: TEXT, use: "success message, Done group" },
  { fg: "warning-ink", bg: "warning-bg", min: TEXT, use: "warning message, Overdue group" },
  { fg: "info-ink", bg: "info-bg", min: TEXT, use: "info message, Due now group" },
  { fg: "neutral-ink", bg: "neutral-bg", min: TEXT, use: "Upcoming / No longer recommended groups" },
  // Crisis support
  { fg: "crisis-ink", bg: "crisis-bg", min: TEXT, use: "crisis support box text" },
  { fg: "crisis-ink", bg: "surface", min: TEXT, use: "crisis Text button" },
  { fg: "on-crisis", bg: "crisis-accent", min: TEXT, use: "crisis Call button, icon" },
  // UI components and graphics (3:1)
  { fg: "line-strong", bg: "surface", min: NON_TEXT, use: "form field edges" },
  { fg: "line-strong", bg: "page", min: NON_TEXT, use: "form field edges on the page" },
  { fg: "primary", bg: "surface", min: NON_TEXT, use: "primary button shape" },
  { fg: "primary", bg: "page", min: NON_TEXT, use: "primary button shape on the page" },
  { fg: "focus", bg: "page", min: NON_TEXT, use: "focus ring" },
  { fg: "focus", bg: "surface", min: NON_TEXT, use: "focus ring in cards" },
  { fg: "focus", bg: "pink-soft", min: NON_TEXT, use: "focus ring on pink" },
  { fg: "focus", bg: "blue-soft", min: NON_TEXT, use: "focus ring on blue" },
  { fg: "focus", bg: "crisis-bg", min: NON_TEXT, use: "focus ring in crisis box" },
  { fg: "crisis-accent", bg: "crisis-bg", min: NON_TEXT, use: "crisis left border, Text button edge" },
  { fg: "danger-ink", bg: "danger-bg", min: NON_TEXT, use: "alert row left border" },
  { fg: "success-ink", bg: "surface", min: NON_TEXT, use: "live connection dot" },
  { fg: "muted", bg: "surface", min: NON_TEXT, use: "connecting dot" },
  { fg: "chart-child", bg: "surface", min: NON_TEXT, use: "baby's line and points" },
  { fg: "chart-child", bg: "chart-band-outer", min: NON_TEXT, use: "baby's line over outer band" },
  { fg: "chart-child", bg: "chart-band-inner", min: NON_TEXT, use: "baby's line over inner band" },
  { fg: "chart-median", bg: "surface", min: NON_TEXT, use: "average-baby dashed line" },
  { fg: "chart-median", bg: "chart-band-outer", min: NON_TEXT, use: "average-baby line over outer band" },
  { fg: "chart-median", bg: "chart-band-inner", min: NON_TEXT, use: "average-baby line over inner band" },
];

/** The --np-* tokens from the :root block of a stylesheet, with
 * var(--np-x) references resolved to their hex values. */
export function parseTokens(css: string): Record<string, string> {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!root) throw new Error("no :root block found");
  const raw: Record<string, string> = {};
  for (const [, name, value] of root[1].matchAll(/--np-([\w-]+):\s*([^;]+);/g)) {
    raw[name] = value.trim();
  }
  const resolve = (name: string, seen: string[] = []): string => {
    const value = raw[name];
    if (value === undefined) throw new Error(`unknown token --np-${name}`);
    const ref = value.match(/^var\(--np-([\w-]+)\)$/);
    if (!ref) return value.toLowerCase();
    if (seen.includes(ref[1])) throw new Error(`token cycle at --np-${name}`);
    return resolve(ref[1], [...seen, name]);
  };
  return Object.fromEntries(Object.keys(raw).map((name) => [name, resolve(name)]));
}

function luminance(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`expected a #rrggbb color, got ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type PairResult = Pair & { fgHex: string; bgHex: string; ratio: number; pass: boolean };

export function checkPairs(tokens: Record<string, string>, pairs: Pair[] = PAIRS): PairResult[] {
  return pairs.map((pair) => {
    const fgHex = tokens[pair.fg];
    const bgHex = tokens[pair.bg];
    if (!fgHex || !bgHex) throw new Error(`unknown token in pair ${pair.fg} / ${pair.bg}`);
    const ratio = contrastRatio(fgHex, bgHex);
    return { ...pair, fgHex, bgHex, ratio, pass: ratio >= pair.min };
  });
}
