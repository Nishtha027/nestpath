// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// Navigation: the same sections in the top tabs and the phone's bottom bar
// plus More sheet, and the right one marked as current for every page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { activeNavKey, navItems, splitForBottomBar } from "./nav.ts";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const read = (...path: string[]) => readFileSync(join(FRONTEND, ...path), "utf8");

test("the bottom bar has Home, Log, History and Insights; More has the rest", () => {
  const { bar, more } = splitForBottomBar(navItems("c1", false));
  assert.deepEqual(bar.map((i) => i.label), ["Home", "Log", "History", "Insights"]);
  assert.deepEqual(more.map((i) => i.label), ["Vaccines", "Growth", "Appointments", "Wellbeing", "Help board"]);
  assert.deepEqual(splitForBottomBar(navItems("c1", true)).more.at(-1)?.label, "Alerts");
});

test("child sections point at the selected child, or Home when there's none", () => {
  const items = navItems("c1", false);
  assert.equal(items.find((i) => i.key === "log")?.href, "/children/c1/log");
  assert.equal(items.find((i) => i.key === "growth")?.href, "/children/c1/growth");
  assert.ok(navItems(null, false).filter((i) => i.key !== "wellbeing" && i.key !== "help-board").every((i) => i.href === "/dashboard"));
});

test("every page marks one section as current", () => {
  assert.equal(activeNavKey("/dashboard"), "home");
  assert.equal(activeNavKey("/children/c1/log"), "log");
  assert.equal(activeNavKey("/children/c1/history"), "history");
  assert.equal(activeNavKey("/children/c1/care-log"), "history");
  assert.equal(activeNavKey("/children/c1/insights"), "insights");
  assert.equal(activeNavKey("/children/c1/share"), "appointments");
  assert.equal(activeNavKey("/children/c1/vaccines"), "vaccines");
  assert.equal(activeNavKey("/wellbeing"), "wellbeing");
  assert.equal(activeNavKey("/help-board"), "help-board");
  assert.equal(activeNavKey("/alerts"), "alerts");
  assert.equal(activeNavKey("/alertsx"), null);
  assert.equal(activeNavKey("/children/c1/unknown"), null);
});

test("the bottom bar is phone-only, sits above the home bar, and the top tabs are wide-screen only", () => {
  const bottom = read("app", "(app)", "BottomNav.tsx");
  assert.match(bottom, /md:hidden/);
  assert.match(bottom, /env\(safe-area-inset-bottom\)/);
  assert.match(bottom, /aria-current/);
  assert.match(bottom, /min-h-14/); // taller than the 44px minimum
  assert.match(read("app", "(app)", "AppNav.tsx"), /hidden[^"]*md:block/);
  // The page scrolls clear of the bar, and notched phones get the safe area.
  assert.match(read("app", "globals.css"), /body:has\(\.np-bottom-nav\)/);
  assert.match(read("app", "layout.tsx"), /viewportFit: "cover"/);
});
