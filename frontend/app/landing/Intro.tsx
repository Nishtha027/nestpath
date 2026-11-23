"use client";

import { useEffect, type CSSProperties } from "react";

type Vars = CSSProperties & Record<`--${string}`, string>;

/** The landing page's intro: a forest panel counts to 100 under the
 * headline, then wipes up (np-intro in globals.css, all CSS). Decorative;
 * the page under it is already rendered and readable. Once per tab session. */
export function Intro() {
  useEffect(() => {
    try {
      sessionStorage.setItem("np-intro", "1");
    } catch {
      // Storage blocked: the intro simply plays again next time.
    }
  }, []);

  return (
    <div aria-hidden="true" className="np-intro flex flex-col justify-between p-6 sm:p-10">
      <div className="flex items-center justify-between text-xs font-bold tracking-[0.24em] text-night-muted uppercase">
        <span className="overflow-hidden">
          <span className="np-intro-rise">NestPath</span>
        </span>
        <span className="overflow-hidden">
          <span className="np-intro-rise" style={{ "--d": "80ms" } as Vars}>
            Open at 3am
          </span>
        </span>
      </div>

      <p className="font-heading text-[clamp(3.2rem,12vw,10rem)] leading-[0.9] font-semibold tracking-[-0.04em]">
        <span className="block overflow-hidden pb-[0.06em]">
          <span className="np-intro-rise" style={{ "--d": "120ms" } as Vars}>
            One baby.
          </span>
        </span>
        <span className="block overflow-hidden pb-[0.06em] text-night-yellow">
          <span className="np-intro-rise" style={{ "--d": "240ms" } as Vars}>
            Many hands.
          </span>
        </span>
      </p>

      <div className="flex items-end gap-6">
        <div className="mb-[0.9em] h-[3px] flex-1 overflow-hidden rounded-full bg-night-line">
          <div className="np-intro-bar h-full bg-night-yellow" />
        </div>
        <span className="np-intro-count font-heading text-[clamp(3rem,10vw,8rem)] leading-none font-semibold text-night-yellow tabular-nums" />
      </div>
    </div>
  );
}
