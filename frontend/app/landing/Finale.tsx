"use client";

import type { CSSProperties } from "react";
import { REGISTER_HREF } from "@/lib/welcome";
import { Icon } from "../ui/Icon";
import { TransitionLink } from "../ui/TransitionLink";
import { useMagnetic } from "./motion";
import { Roll, Words } from "./Words";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const WORDMARK = "NestPath";

/** The closing band: acid lime, a last big line, a round magnetic button,
 * and the wordmark at full width, its letters rising as it scrolls in. */
export function Finale() {
  const cta = useMagnetic<HTMLAnchorElement>(0.35);

  return (
    <section id="start" data-reveal aria-labelledby="finale-title" className="np-grain relative overflow-hidden bg-lime pt-24 text-ink lg:pt-36">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-8">
        <p className="np-in-view inline-flex items-center gap-2 text-xs font-bold tracking-[0.24em] text-primary-ink uppercase">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
          Free, and ready tonight
        </p>
        <h2
          id="finale-title"
          className="font-heading text-[clamp(3rem,9.5vw,8.4rem)] leading-[0.92] font-semibold tracking-[-0.035em]"
        >
          <span className="block">
            <Words text="Start the log" />
          </span>
          <span className="block">
            <Words text="before the next feed." from={3} />
          </span>
        </h2>
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="np-in-view max-w-md text-lg" style={{ "--d": "300ms" } as Vars}>
            Make a family, share the invite code, and every caregiver logs to the same timeline from their own phone.
          </p>
          <TransitionLink
            ref={cta}
            href={REGISTER_HREF}
            className="np-cta np-magnetic np-roll-host inline-flex h-40 w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-on-primary hover:bg-primary-hover sm:h-48 sm:w-48"
          >
            <Roll>Get started</Roll>
            <span className="np-nudge inline-flex">
              <Icon name="arrowRight" className="h-6 w-6" />
            </span>
          </TransitionLink>
        </div>
      </div>

      <p
        aria-hidden="true"
        className="np-scroll-drift mt-16 pb-[1.5vw] text-center font-heading text-[23.5vw] leading-[0.8] font-semibold tracking-[-0.06em] text-primary-ink select-none"
      >
        {WORDMARK.split("").map((letter, i) => (
          <span key={i} className="np-word-mask">
            <span className="np-word" style={{ "--i": i, "--d": "150ms" } as Vars}>
              {letter}
            </span>
          </span>
        ))}
      </p>
    </section>
  );
}
