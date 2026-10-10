// Run with: npm test  (Node's built-in test runner; no extra dependencies)
//
// The welcome screen at /: logged-out visitors see it, the main button opens
// the Register tab of /login, the text link opens Log in, and anyone with a
// session goes on to /dashboard. The routing rules are plain functions
// (lib/welcome.ts) tested directly; the checks on the page source make sure
// the screen actually uses them; rendering itself is checked in a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { authModeFrom, LOGIN_HREF, REGISTER_HREF, welcomeRedirect } from "./welcome.ts";

const FRONTEND = fileURLToPath(new URL("..", import.meta.url));
const read = (...path: string[]) => readFileSync(join(FRONTEND, ...path), "utf8");

const modeOf = (href: string) => authModeFrom(new URL(href, "http://localhost").searchParams.get("mode"));

test("logged-out visitors stay on the welcome screen", () => {
  assert.equal(welcomeRedirect(true, null), null);
  // Before the stored session has been read, nothing moves yet.
  assert.equal(welcomeRedirect(false, null), null);
  assert.equal(welcomeRedirect(false, "token"), null);
});

test("a logged-in visitor is sent to the dashboard", () => {
  assert.equal(welcomeRedirect(true, "token"), "/dashboard");
});

test("Get started opens Register, the text link opens Log in", () => {
  assert.equal(new URL(REGISTER_HREF, "http://localhost").pathname, "/login");
  assert.equal(modeOf(REGISTER_HREF), "register");
  assert.equal(new URL(LOGIN_HREF, "http://localhost").pathname, "/login");
  assert.equal(modeOf(LOGIN_HREF), "login");
  // Anything else in ?mode= falls back to Log in.
  assert.equal(authModeFrom(null), "login");
  assert.equal(authModeFrom("REGISTER"), "login");
  assert.equal(authModeFrom("admin"), "login");
});

test("/ renders the welcome screen, wired to those rules", () => {
  assert.match(read("app", "page.tsx"), /return <Welcome \/>/);

  const welcome = read("app", "Welcome.tsx");
  assert.match(welcome, /<h1\b/);
  assert.match(welcome, /href=\{REGISTER_HREF\}[\s\S]*?>\s*Get started/);
  assert.match(welcome, /href=\{LOGIN_HREF\}[\s\S]*?>\s*I already have an account/);
  assert.match(welcome, /welcomeRedirect\(ready, token\)/);
  assert.match(welcome, /if \(redirectTo\) router\.replace\(redirectTo\)/);
  // The free-tier API starts waking while the visitor reads.
  assert.match(welcome, /wakeApi\(\)/);
});

test("/login opens the tab named in the address", () => {
  const login = read("app", "login", "page.tsx");
  assert.match(login, /authModeFrom\(useSearchParams\(\)\.get\("mode"\)\)/);
  assert.match(login, /<Suspense\b/);
  assert.match(login, /wakeApi\(\)/);
});

test("the welcome illustration is decorative and has no text", () => {
  const art = read("app", "ui", "illustrations", "ParentAndBaby.tsx");
  assert.match(art, /aria-hidden="true"/);
  assert.doesNotMatch(art, /<text\b|<image\b|href=/);
});
