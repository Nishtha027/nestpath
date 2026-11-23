"use client";

import { useEffect, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

type Vars = CSSProperties & Record<`--${string}`, string>;

// Page transitions. A TransitionLink sets data-curtain="cover" on <html>:
// a lime panel, then a forest one, rise over the page (globals.css). Once
// they are up, the link navigates; when the new path renders, PageCurtain
// sets "reveal" and the panels lift off the top. Then the attribute goes and
// the curtain parks below the screen again, without a transition.
const COVER_MS = 650 + 90;
const REVEAL_MS = 750 + 90;
// If the route never changes (a failed navigation), lift the curtain anyway.
const GIVE_UP_MS = 6000;

function reveal() {
  const html = document.documentElement;
  html.dataset.curtain = "reveal";
  window.setTimeout(() => {
    if (html.dataset.curtain === "reveal") delete html.dataset.curtain;
  }, REVEAL_MS + 60);
}

/** Covers the page, then runs `go` (the navigation). Straight to `go` with
 * reduced motion, or if a transition is already running. */
export function coverThen(go: () => void) {
  const html = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || html.dataset.curtain) {
    go();
    return;
  }
  html.dataset.curtain = "cover";
  window.setTimeout(go, COVER_MS);
  window.setTimeout(() => {
    if (html.dataset.curtain === "cover") reveal();
  }, GIVE_UP_MS);
}

/** The curtain itself, once in the root layout (it outlives navigations). */
export function PageCurtain() {
  const pathname = usePathname();

  useEffect(() => {
    if (document.documentElement.dataset.curtain !== "cover") return;
    // Two frames: the new page has painted under the curtain before it lifts.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(reveal);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div aria-hidden="true" className="np-curtain">
      <div className="np-curtain-panel bg-lime" style={{ "--d": "0ms", "--r": "90ms" } as Vars} />
      <div
        className="np-curtain-panel flex items-center justify-center bg-night"
        style={{ "--d": "90ms", "--r": "0ms" } as Vars}
      >
        <span className="font-heading text-[clamp(3rem,10vw,8rem)] leading-none font-semibold tracking-[-0.03em] text-on-night">
          Nest<span className="text-night-yellow">Path</span>
        </span>
      </div>
    </div>
  );
}
