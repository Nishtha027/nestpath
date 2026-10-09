// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPairs, contrastRatio, parseTokens } from "./contrast.ts";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const tokens = parseTokens(readFileSync(join(FRONTEND, "app", "globals.css"), "utf8"));

test("contrast math matches known values", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrastRatio("#ffffff", "#ffffff").toFixed(2), "1.00");
  assert.equal(contrastRatio("#767676", "#ffffff").toFixed(2), "4.54"); // the classic AA grey
});

test("var() references between tokens resolve", () => {
  assert.equal(tokens["secondary-bg"], tokens["pink-soft"]);
  assert.equal(tokens["chart-axis"], tokens["muted"]);
});

test("every text/background and UI-component pair meets WCAG AA", () => {
  const failures = checkPairs(tokens).filter((r) => !r.pass);
  assert.deepEqual(
    failures.map((f) => `${f.fg} on ${f.bg}: ${f.ratio.toFixed(2)} < ${f.min}`),
    []
  );
});

// Colors live only in app/globals.css. Anything else (a hex value, rgb(),
// or a Tailwind palette class like text-zinc-600) would bypass the tokens
// and the contrast check above.
test("no hard-coded colors outside the design tokens", () => {
  const PALETTE =
    /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|accent|decoration|divide|shadow)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;
  const RAW = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
  const offenders: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) {
        readFileSync(path, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (PALETTE.test(line) || RAW.test(line)) offenders.push(`${path}:${i + 1}: ${line.trim()}`);
          });
      }
    }
  }
  walk(join(FRONTEND, "app"));
  walk(join(FRONTEND, "lib"));
  assert.deepEqual(offenders, []);
});
