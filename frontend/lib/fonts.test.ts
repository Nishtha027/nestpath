// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// app/layout.tsx loads only some weights of each font (Nunito for body
// text, Fredoka for headings). A class asking for a weight that isn't
// loaded renders in the nearest one instead, so every font-* weight class
// in the source must match a loaded weight of the font it applies to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const layout = readFileSync(join(FRONTEND, "app", "layout.tsx"), "utf8");
const css = readFileSync(join(FRONTEND, "app", "globals.css"), "utf8");

const WEIGHT = { normal: "400", medium: "500", semibold: "600", bold: "700", extrabold: "800", black: "900", light: "300", thin: "100" } as const;

function loadedWeights(family: string): string[] {
  const call = layout.match(new RegExp(`${family}\\(\\{([^}]*)\\}\\)`));
  assert.ok(call, `${family} is not loaded in app/layout.tsx`);
  return [...call[1].match(/weight: \[([^\]]*)\]/)![1].matchAll(/"(\d+)"/g)].map((m) => m[1]);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

test("fonts are tokens and both are self-hosted with display swap", () => {
  assert.match(css, /--font-heading: var\(--font-fredoka\)/);
  assert.match(css, /--font-body: var\(--font-nunito\)/);
  assert.match(layout, /from "next\/font\/google"/);
  assert.equal((layout.match(/display: "swap"/g) ?? []).length, 2);
});

test("every font weight used is a loaded weight", () => {
  const body = loadedWeights("Nunito");
  const heading = loadedWeights("Fredoka");
  const headingClasses = /font-heading|PAGE_TITLE|SECTION_TITLE|SUBSECTION_TITLE|<h[1-4]/;
  const offenders: string[] = [];
  for (const path of [...sourceFiles(join(FRONTEND, "app")), ...sourceFiles(join(FRONTEND, "lib"))]) {
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const m of line.matchAll(/\bfont-(normal|medium|semibold|bold|extrabold|black|light|thin)\b/g)) {
          const weight = WEIGHT[m[1] as keyof typeof WEIGHT];
          // Headings render in Fredoka (h1-h4 get it from the base styles).
          const loaded = headingClasses.test(line) ? heading : body;
          if (!loaded.includes(weight)) offenders.push(`${path}:${i + 1}: font-${m[1]} (${weight})`);
        }
      });
  }
  assert.deepEqual(offenders, []);
});
