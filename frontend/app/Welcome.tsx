"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wakeApi } from "@/lib/server-wake";
import { LOGIN_HREF, REGISTER_HREF, welcomeRedirect } from "@/lib/welcome";
import { Icon, type IconName } from "./ui/Icon";
import { TransitionLink } from "./ui/TransitionLink";
import { DayScroll } from "./landing/DayScroll";
import { FeaturePath } from "./landing/FeaturePath";
import { Finale } from "./landing/Finale";
import { Follower } from "./landing/Follower";
import { HeroPhone } from "./landing/HeroPhone";
import { Intro } from "./landing/Intro";
import { LandingHeader } from "./landing/LandingHeader";
import { LiveSync } from "./landing/LiveSync";
import { Marquee } from "./landing/Marquee";
import { useMagnetic, usePointerParallax, useScrollReveal } from "./landing/motion";
import { Avatar, Badge, LiveDot, type Tone } from "./landing/Phone";
import { Sticker } from "./landing/Sticker";
import { UnderTheHood } from "./landing/UnderTheHood";
import { Roll, Words } from "./landing/Words";

type Vars = CSSProperties & Record<`--${string}`, string>;
// Entrances wait for the intro to lift (--intro on .np-hero, globals.css).
const delay = (ms: number) => ({ animationDelay: `calc(var(--intro, 0ms) + ${ms}ms)` });
// Idle loops start part-way through, so neighbours don't move in step.
const phase = (ms: number) => ({ animationDelay: `${ms}ms` });

// The headline is six words in three lines; the rest follows it in.
const AFTER_HEADLINE_MS = 6 * 80 + 250;

type Chip = { icon: IconName; tone: Tone; title: string; sub: string; place: string; depth: number; loop: string };

// Little notes floating around the phone, each from a different part of
// the app. They drift with the pointer at different depths.
const CHIPS: Chip[] = [
  { icon: "calendar", tone: "blue", title: "4-month shots", sub: "Due in 4 days", place: "-left-4 top-[62%] sm:-left-24", depth: 26, loop: "np-loop-float" },
  { icon: "trendUp", tone: "pink", title: "6.4 kg", sub: "50th percentile", place: "-right-4 top-[22%] sm:-right-20", depth: 42, loop: "np-loop-bob" },
  { icon: "heart", tone: "green", title: "Priya claimed", sub: "Drop off dinner, Thu", place: "-right-2 bottom-[9%] hidden sm:block sm:-right-24", depth: 18, loop: "np-loop-float" },
];

/** The first screen for visitors who aren't logged in, and the whole
 * landing page under it. Someone with a session goes straight on to the
 * dashboard. */
export function Welcome() {
  const { token, ready } = useAuth();
  const router = useRouter();
  const redirectTo = welcomeRedirect(ready, token);
  const page = useRef<HTMLElement>(null);
  const hero = useRef<HTMLElement>(null);
  const cta = useMagnetic<HTMLAnchorElement>(0.3);

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // Warm the free-tier API while the visitor reads, so logging in is quick.
  useEffect(() => {
    wakeApi();
  }, []);

  useScrollReveal(page);
  usePointerParallax(hero);

  if (redirectTo) return null;

  return (
    <main ref={page} className="relative isolate flex-1 overflow-x-clip">
      <Intro />
      <Follower />
      <LandingHeader />

      <section
        ref={hero}
        className="np-hero np-night np-grain relative isolate flex min-h-[100svh] items-center overflow-hidden bg-night pt-28 pb-24 text-on-night lg:pt-28"
      >
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="np-dots-night absolute inset-0" />
          <div className="np-blob np-blob-lime np-loop-blob -top-[30%] -right-[20%] h-[75vmax] w-[75vmax] opacity-30" />
          <div className="np-blob np-blob-pink np-loop-blob np-loop-minor -bottom-[40%] -left-[20%] h-[65vmax] w-[65vmax] opacity-20" style={phase(-7000)} />
          <div className="np-blob np-blob-lime np-loop-blob np-loop-minor top-[40%] left-[30%] h-[40vmax] w-[40vmax] opacity-15" style={phase(-13000)} />
        </div>

        <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-4 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
          <div className="flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
            <p
              className="np-reveal inline-flex items-center gap-2.5 rounded-full border border-night-line bg-night-raised py-1.5 pr-4 pl-2.5 text-sm font-semibold text-on-night"
              style={delay(0)}
            >
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-night-yellow px-2 text-xs font-bold text-night">
                <LiveDot className="h-2 w-2" tone="night" />
                Live
              </span>
              A shared baby tracker<span className="hidden sm:inline">&nbsp;for the whole family</span>
            </p>

            <h1 className="np-words-load font-heading text-[clamp(2.9rem,min(8.4vw,11.5vh),6.6rem)] leading-[0.94] font-semibold tracking-[-0.03em] text-on-night lg:whitespace-nowrap">
              <span className="block">
                <Words text="One baby." />
              </span>
              <span className="relative mx-auto block w-fit lg:mx-0">
                <Words text="Many hands." from={2} wordClassName="text-night-yellow" />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 300 24"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute -bottom-[0.06em] left-0 h-[0.22em] w-full overflow-visible"
                >
                  <path
                    d="M4 16 C 60 6, 110 6, 150 12 S 240 20, 296 8"
                    pathLength={1}
                    fill="none"
                    stroke="var(--np-night-pink)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    className="np-draw-slow"
                    style={{ "--d": "calc(var(--intro, 0ms) + 900ms)" } as Vars}
                  />
                </svg>
              </span>
              <span className="block">
                <Words text="One shared log." from={4} />
              </span>
            </h1>

            <p className="np-reveal max-w-xl text-lg text-night-muted sm:text-xl" style={delay(AFTER_HEADLINE_MS)}>
              No more &ldquo;did anyone feed her?&rdquo; NestPath keeps feeds, naps, diapers, vaccines and growth in one
              place, live on every caregiver&apos;s phone.
            </p>

            <div className="np-reveal flex flex-col items-center gap-3 sm:flex-row" style={delay(AFTER_HEADLINE_MS + 120)}>
              <TransitionLink
                ref={cta}
                href={REGISTER_HREF}
                className="np-cta np-magnetic np-roll-host inline-flex min-h-14 items-center gap-2 rounded-full bg-night-yellow px-8 text-lg font-bold text-night hover:bg-night-blue"
              >
                <Roll>Get started</Roll>
                <span className="np-nudge inline-flex">
                  <Icon name="arrowRight" className="h-5 w-5" />
                </span>
              </TransitionLink>
              <TransitionLink
                href={LOGIN_HREF}
                className="np-roll-host inline-flex min-h-14 items-center rounded-full border border-night-line px-7 text-base font-semibold text-on-night hover:bg-night-raised"
              >
                <Roll>I already have an account</Roll>
              </TransitionLink>
            </div>

            <ul
              className="np-reveal flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-night-muted lg:justify-start"
              style={delay(AFTER_HEADLINE_MS + 240)}
            >
              {["CDC vaccine schedule", "WHO growth charts", "Syncs live"].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Icon name="checkCircle" className="h-4 w-4 text-night-yellow" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem]">
            <div className="np-scroll-sink">
              <div className="np-reveal-art" style={delay(350)}>
                <div className="np-tilt">
                  <HeroPhone />
                </div>
              </div>
            </div>

            <div aria-hidden="true" className="np-reveal absolute -top-14 -left-10 z-20 hidden sm:block sm:-left-24" style={delay(AFTER_HEADLINE_MS + 200)}>
              <div className="np-parallax" style={{ "--depth": "-22px" } as Vars}>
                <Sticker className="h-28 w-28 sm:h-32 sm:w-32" />
              </div>
            </div>

            <div aria-hidden="true" className="np-reveal absolute -top-6 -right-2 z-20 sm:-right-14" style={delay(AFTER_HEADLINE_MS + 300)}>
              <div className="np-parallax" style={{ "--depth": "34px" } as Vars}>
                <div className="np-soft-shadow flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-1.5">
                  <span className="flex -space-x-2">
                    <Avatar name="Sam" tone="pink" className="h-7 w-7 text-xs" />
                    <Avatar name="Rose" tone="blue" className="h-7 w-7 text-xs" />
                    <Avatar name="Priya" tone="green" className="h-7 w-7 text-xs" />
                  </span>
                  <span className="text-xs font-bold text-ink">3 caregivers</span>
                </div>
              </div>
            </div>

            {CHIPS.map((chip, i) => (
              <div key={chip.title} aria-hidden="true" className={`absolute z-20 ${chip.place}`}>
                <div className="np-reveal" style={delay(AFTER_HEADLINE_MS + 420 + i * 160)}>
                  <div className="np-parallax" style={{ "--depth": `${chip.depth}px` } as Vars}>
                    <div className={chip.loop} style={phase(-i * 2300)}>
                      <div className="np-soft-shadow flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-2.5 pr-4 pl-2.5">
                        <Badge icon={chip.icon} tone={chip.tone} className="h-9 w-9" />
                        <span className="flex flex-col text-left leading-tight">
                          <span className="text-sm font-bold whitespace-nowrap text-ink">{chip.title}</span>
                          <span className="text-xs whitespace-nowrap text-muted">{chip.sub}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <a
          href="#live"
          className="np-reveal absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-[0.2em] text-night-muted uppercase [@media(min-height:760px)]:flex"
          style={delay(AFTER_HEADLINE_MS + 700)}
        >
          Scroll
          <span aria-hidden="true" className="flex h-9 w-5 justify-center rounded-full border-2 border-night-line pt-1.5">
            <span className="np-loop-bob h-2 w-1 rounded-full bg-night-yellow" />
          </span>
        </a>
      </section>

      <Marquee />
      <LiveSync />
      <DayScroll />
      <FeaturePath />
      <UnderTheHood />
      <Finale />
    </main>
  );
}
