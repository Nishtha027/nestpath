"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wakeApi } from "@/lib/server-wake";
import { LOGIN_HREF, REGISTER_HREF, welcomeRedirect } from "@/lib/welcome";
import { Icon } from "./ui/Icon";
import { Sprig } from "./ui/illustrations/Foliage";
import { WelcomeHero } from "./ui/illustrations/WelcomeHero";

const HEADLINE = ["Grow", "together,", "day", "by", "day"];
const STAGGER_MS = 80;
// The subline, buttons and illustration follow the last headline word.
const AFTER_HEADLINE_MS = HEADLINE.length * STAGGER_MS;

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

/** A sprig in a corner of the page, behind everything else. With `loop`, it
 * sways: the wrapping <span> moves (a compositor-only animation; Chrome
 * won't do that for an <svg>), and phones keep it still. */
function CornerSprig({ flip = false, loop, className }: { flip?: boolean; loop?: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 h-20 w-14 sm:h-32 sm:w-24 ${loop ? `${loop} np-loop-minor` : ""} ${className}`}
    >
      <svg viewBox="0 0 80 112" focusable="false" className="block h-full w-full">
        <Sprig x={flip ? 38 : 42} y={110} flip={flip} />
      </svg>
    </span>
  );
}

/** The first screen for visitors who aren't logged in. Someone with a
 * session goes straight on to the dashboard. */
export function Welcome() {
  const { token, ready } = useAuth();
  const router = useRouter();
  const redirectTo = welcomeRedirect(ready, token);

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // Warm the free-tier API while the visitor reads, so logging in is quick.
  useEffect(() => {
    wakeApi();
  }, []);

  if (redirectTo) return null;

  return (
    <main className="relative isolate flex flex-1 items-center overflow-x-clip">
      <CornerSprig loop="np-loop-sway" className="bottom-0 left-1" />
      <CornerSprig flip loop="np-loop-sway-back" className="right-1 bottom-0" />
      {/* Only on wider screens: on a phone it would touch the headline. */}
      <CornerSprig flip className="top-1 left-1 hidden rotate-180 sm:block" />
      <div className="mx-auto grid w-full max-w-5xl items-center gap-4 px-4 pt-8 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
          <h1 className="font-heading text-[2.6rem] leading-[1.1] font-semibold text-ink sm:text-5xl lg:text-6xl">
            {HEADLINE.map((word, i) => (
              <span key={i}>
                <span className="np-reveal inline-block" style={delay(i * STAGGER_MS)}>
                  {word}
                </span>{" "}
              </span>
            ))}
          </h1>
          <p className="np-reveal text-lg text-muted" style={delay(AFTER_HEADLINE_MS)}>
            NestPath keeps your baby&apos;s care in one shared place.
          </p>
          <div className="mt-2 flex flex-col items-center gap-1 lg:items-start">
            <Link
              href={REGISTER_HREF}
              className="np-reveal np-cta np-press inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-on-primary hover:bg-primary-hover"
              style={delay(AFTER_HEADLINE_MS + 100)}
            >
              Get started
              <span className="np-nudge inline-flex">
                <Icon name="arrowRight" className="h-5 w-5" />
              </span>
            </Link>
            <Link
              href={LOGIN_HREF}
              className="np-reveal inline-flex min-h-11 items-center rounded-full px-1 text-sm font-semibold text-primary-ink underline decoration-blue-mid decoration-2 underline-offset-4 hover:decoration-primary-ink"
              style={delay(AFTER_HEADLINE_MS + 160)}
            >
              I already have an account
            </Link>
          </div>
        </div>
        <WelcomeHero animated revealDelayMs={AFTER_HEADLINE_MS + 200} />
      </div>
    </main>
  );
}
