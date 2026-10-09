// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// The copy is kept short, but some of it must never be cut. These checks
// read the source, so they fail if a later edit trims too far:
// - support lines keep every number, the "not a crisis line" note and the
//   date each was last checked;
// - crisis support keeps 988 and the emergency number, and screening
//   results still say they are not a diagnosis;
// - the medical disclaimer stays in the footer, and Growth keeps its
//   steady-curve note and the check-up suggestion;
// - UI text stays free of filler phrases and em dashes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORT_RESOURCES } from "./support-resources.ts";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const read = (...path: string[]) => readFileSync(join(FRONTEND, ...path), "utf8");

test("support lines keep their numbers, notes and verification dates", () => {
  const us = SUPPORT_RESOURCES.US;
  assert.equal(us.crisisLine.display, "988");
  assert.equal(us.emergencyNumber, "911");
  const byName = Object.fromEntries(us.postpartumLines.map((line) => [line.name, line]));
  assert.match(byName["National Maternal Mental Health Hotline"].display, /1-833-852-6262/);
  assert.match(byName["Postpartum Support International (PSI) HelpLine"].display, /1-800-944-4773/);
  assert.match(byName["Postpartum Support International (PSI) HelpLine"].description, /Not a crisis line/);
  for (const line of [us.crisisLine, ...us.postpartumLines]) assert.match(line.lastVerified, /^\d{4}-\d{2}-\d{2}$/);

  const lines = read("app", "(app)", "wellbeing", "SupportLines.tsx");
  assert.match(lines, /last checked \{line\.lastVerified\}/);
  assert.match(lines, /\{line\.display\}/);
  assert.match(lines, /immediate danger/);
});

test("crisis support and results keep their essential wording", () => {
  const lines = read("app", "(app)", "wellbeing", "SupportLines.tsx");
  const crisis = lines.slice(lines.indexOf("export function CrisisSupport"), lines.indexOf("export function SupportLines"));
  assert.match(crisis, /call or text [\s\S]*\{crisis\.display\}/);
  assert.match(crisis, /href=\{`tel:\$\{crisis\.tel\}`\}/);
  assert.match(crisis, /href=\{`sms:\$\{crisis\.tel\}`\}/);
  assert.match(crisis, /\{resources\.emergencyNumber\}/);

  const page = read("app", "(app)", "wellbeing", "page.tsx");
  // Before the questions, and with every result.
  assert.ok((page.match(/not a diagnosis/g) ?? []).length >= 2, "\"not a diagnosis\" missing from Wellbeing");
});

test("the disclaimer and the growth notes stay on screen", () => {
  assert.match(read("app", "ui", "Footer.tsx"), /not medical advice/);
  assert.match(read("app", "layout.tsx"), /<Footer \/>/);
  const growth = read("app", "(app)", "children", "[id]", "GrowthChart.tsx");
  assert.match(growth, /steady curve matters more than being on the average line/);
  assert.match(growth, /next check-up/);
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

test("UI text has no filler phrases or em dashes", () => {
  const banned = /seamless|effortless|empower|journey|gentle reminder|Here(?:'|&apos;)s|Let(?:'|&apos;)s|Oops|—| -- /i;
  const offenders: string[] = [];
  for (const path of [...sourceFiles(join(FRONTEND, "app")), join(FRONTEND, "lib", "wellbeing.ts"), join(FRONTEND, "lib", "support-resources.ts")]) {
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const code = line.trim();
        // Comments may use "--"; only rendered text is checked.
        if (/^(\/\/|\*|\/\*|\{\/\*)/.test(code)) return;
        if (banned.test(code.replace(/\/\/.*$/, ""))) offenders.push(`${path}:${i + 1}: ${code}`);
      });
  }
  assert.deepEqual(offenders, []);
});
