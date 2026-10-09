// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// Reduced motion and calm pages, checked from the source:
// - every np-* class that moves something (an animation whose keyframes use
//   transform, or a transform on :hover / :active) is switched off again in
//   the prefers-reduced-motion block of app/globals.css;
// - components only animate through those classes (no Tailwind animate-*
//   utilities, no inline animation or transition styles);
// - Wellbeing and Alerts stay still: no characters on Alerts, and nothing
//   animated anywhere in the Wellbeing screens.
// A browser check complements this: with reduced motion emulated in Chrome,
// document.getAnimations() should list nothing running on any page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(join(FRONTEND, "app", "globals.css"), "utf8");

/** The text inside the braces that open at `start` (index of "{"). */
function block(text: string, start: number): string {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start + 1, i);
  }
  throw new Error("unbalanced braces");
}

const REDUCE_AT = css.indexOf("@media (prefers-reduced-motion: reduce)");
const reduce = block(css, css.indexOf("{", REDUCE_AT));
const rest = css.replace(reduce, "");

const keyframes = new Map<string, string>();
for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
  keyframes.set(m[1], block(css, m.index! + m[0].length - 1));
}

/** Innermost "selector { declarations }" rules of a stylesheet fragment. */
function rules(text: string) {
  const withoutKeyframes = text.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...withoutKeyframes.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].replace(/@media[^{]*$/, "").split(",").map((s) => s.trim()).filter(Boolean),
    body: m[2],
  }));
}

/** The np-* class a selector targets, e.g. ".np-still .np-lift:hover" -> "np-lift". */
function targetClass(selector: string): string | null {
  const classes = [...selector.matchAll(/\.(np-[\w-]+)/g)].map((m) => m[1]);
  return classes.at(-1) ?? null;
}

test("the reduced-motion block keeps its catch-all for every element", () => {
  assert.ok(REDUCE_AT > 0, "no prefers-reduced-motion block in globals.css");
  for (const prop of ["animation-duration", "animation-iteration-count", "transition-duration"]) {
    assert.match(reduce, new RegExp(`${prop}:[^;]*!important`), `${prop} missing from the catch-all`);
  }
});

test("every moving np-* class is turned off under reduced motion", () => {
  const moving = new Set<string>();
  for (const { selectors, body } of rules(rest)) {
    const animations = [...body.matchAll(/animation(?:-name)?:\s*([^;]+);/g)].flatMap((m) =>
      m[1].split(",").map((part) => part.trim().split(/\s+/)[0])
    );
    const movesByKeyframes = animations.some((name) => /transform/.test(keyframes.get(name) ?? ""));
    for (const selector of selectors) {
      const cls = targetClass(selector);
      if (!cls || selector.startsWith(".np-still")) continue;
      const movesOnInteraction = /:(hover|active)/.test(selector) && /transform:\s*(?!none)/.test(body);
      if (movesByKeyframes || movesOnInteraction || cls === "np-tab-indicator") moving.add(cls);
    }
  }
  assert.ok(moving.size >= 8, `expected the motion classes, found ${[...moving].join(", ")}`);

  const offInReduce = new Set<string>();
  for (const { selectors, body } of rules(reduce)) {
    const stops =
      /animation:\s*none/.test(body) ||
      /transform:\s*none/.test(body) ||
      /transition:\s*none/.test(body) ||
      // np-arrive keeps only its tint change, made instant and motionless.
      (/animation:\s*np-glow/.test(body) && !/transform/.test(keyframes.get("np-glow") ?? ""));
    if (stops) for (const s of selectors) if (targetClass(s)) offInReduce.add(targetClass(s)!);
  }
  const missing = [...moving].filter((cls) => !offInReduce.has(cls));
  assert.deepEqual(missing, [], "add these to the prefers-reduced-motion block");
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

// The breathing exercise (Wellbeing toolkit) paces its circle inline, only
// while the user runs it, and checks reduced motion itself. It is the one
// exception.
const OWN_MOTION = [join("wellbeing", "Toolkit.tsx")];

test("components animate only through the np-* classes", () => {
  const offenders: string[] = [];
  for (const path of [...sourceFiles(join(FRONTEND, "app")), ...sourceFiles(join(FRONTEND, "lib"))]) {
    if (OWN_MOTION.some((file) => path.endsWith(file))) continue;
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, i) => {
        // An inline animationDelay (staggering sparkles) is fine; anything
        // that defines the movement itself would bypass reduced motion.
        if (/\banimate-[a-z]/.test(line) || /\b(animation|animationName|animationDuration|transition)\s*:/.test(line))
          offenders.push(`${path}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(offenders, []);
});

test("Wellbeing and Alerts stay calm", () => {
  const layout = readFileSync(join(FRONTEND, "app", "(app)", "layout.tsx"), "utf8");
  assert.match(layout, /STILL_PAGES = \[[^\]]*"\/wellbeing"[^\]]*"\/alerts"/);

  // Alerts: no characters at all.
  const alerts = sourceFiles(join(FRONTEND, "app", "(app)", "alerts"));
  for (const path of alerts) assert.doesNotMatch(readFileSync(path, "utf8"), /illustrations/, path);

  // Wellbeing: at most one illustration, still, and not in the results or
  // crisis support components.
  const wellbeing = sourceFiles(join(FRONTEND, "app", "(app)", "wellbeing"));
  let characters = 0;
  for (const path of wellbeing) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /np-(loop|arrive|pop|cheer|draw)|\banimated\b|<Loading\b|LoadError/, path);
    if (!path.endsWith("page.tsx")) assert.doesNotMatch(source, /illustrations/, path);
    characters += [...source.matchAll(/<(Chick|Bunny|BearCub|Duckling)\b/g)].length;
  }
  assert.ok(characters <= 1, `found ${characters} illustrations on Wellbeing`);
});
