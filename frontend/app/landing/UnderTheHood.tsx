"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { PAIRS } from "@/lib/contrast";
import { Icon, type IconName } from "../ui/Icon";
import { useCountUp, useSpotlight } from "./motion";
import { Words, revealDelay } from "./Words";

const REPO = "https://github.com/Nishtha027/nestpath";
const API_DOCS = "https://nestpath-api.onrender.com/docs";

// Counted from the repository: backend pytest functions plus the frontend
// node:test cases, the routes across backend/app/routers, and the Alembic
// migrations. The contrast pairs are read live from lib/contrast.ts.
const STATS = [
  { to: 200, suffix: "+", label: "automated tests" },
  { to: 28, suffix: "", label: "API endpoints" },
  { to: 10, suffix: "", label: "database migrations" },
  { to: PAIRS.length, suffix: "", label: "color pairs held to WCAG AA" },
];

const STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind 4",
  "FastAPI",
  "SQLAlchemy 2",
  "Alembic",
  "Postgres",
  "WebSockets",
  "Vercel",
  "Render",
  "Neon",
];

function Stat({ to, suffix, label }: { to: number; suffix: string; label: string }) {
  const [ref, value] = useCountUp(to, 1800);
  return (
    <div className="flex flex-col gap-1 border-t border-night-line pt-5">
      <span className="font-heading text-[clamp(2.6rem,5vw,4rem)] leading-none font-semibold text-on-night tabular-nums">
        <span ref={ref} aria-hidden="true">
          {value}
          {suffix}
        </span>
        <span className="sr-only">
          {to}
          {suffix}
        </span>
      </span>
      <span className="text-sm text-night-muted">{label}</span>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
  className = "",
  delay = 0,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <article
      className={`np-spotlight np-in-view flex flex-col gap-4 rounded-3xl border border-night-line bg-night-raised p-6 sm:p-7 ${className}`}
      style={revealDelay(delay)}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-night text-night-yellow">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h3 className="font-heading text-xl font-semibold text-on-night">{title}</h3>
      {children}
    </article>
  );
}

const DEVICES = [
  { name: "Sam", delay: 0 },
  { name: "Rose", delay: 0.5 },
  { name: "Priya", delay: 1 },
];

/** Postgres, then FastAPI, then every caregiver's open screen: the order a
 * care-log entry travels in. */
function SyncDiagram() {
  return (
    <div aria-hidden="true" className="mt-2 grid grid-cols-[auto_1fr_auto_1.4fr_auto] items-center gap-0 text-xs font-bold sm:text-sm">
      <span className="rounded-xl border border-night-line bg-night px-3 py-2 text-night-blue">Postgres</span>
      <span className="relative mx-1 h-px bg-night-line">
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wider text-night-muted uppercase">
          commit
        </span>
      </span>
      <span className="rounded-xl border border-night-line bg-night px-3 py-2 text-night-pink">FastAPI</span>
      <span className="relative mx-1 flex h-28 flex-col justify-between py-3">
        {DEVICES.map((d) => (
          <span key={d.name} className="relative block h-px bg-night-line">
            <span className="np-loop-run absolute inset-y-0 left-0 w-full" style={{ "--run": "100%", animationDelay: `${d.delay}s` } as CSSProperties}>
              <span className="absolute -top-[3px] -left-[3px] h-[7px] w-[7px] rounded-full bg-night-yellow" />
            </span>
          </span>
        ))}
      </span>
      <span className="flex flex-col gap-2">
        {DEVICES.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5 rounded-xl border border-night-line bg-night px-2.5 py-1.5 text-on-night">
            <Icon name="phone" className="h-3.5 w-3.5 text-night-muted" />
            {d.name}
          </span>
        ))}
      </span>
    </div>
  );
}

const BODY = "text-sm leading-relaxed text-night-muted sm:text-base";

export function UnderTheHood() {
  const grid = useRef<HTMLDivElement>(null);
  useSpotlight(grid);
  return (
    <section id="built" data-reveal className="np-night np-grain relative scroll-mt-24 overflow-hidden bg-night px-4 py-24 text-on-night sm:px-8 lg:py-36">
      <div aria-hidden="true" className="np-blob np-blob-pink np-loop-blob -top-40 -left-40 h-[36rem] w-[36rem] opacity-25" />
      <div aria-hidden="true" className="np-blob np-blob-lime np-loop-blob -right-40 -bottom-40 h-[40rem] w-[40rem] opacity-20" style={{ animationDelay: "-8s" }} />

      <div className="relative mx-auto max-w-6xl">
        <p className="np-in-view inline-flex items-center gap-2 rounded-full border border-night-line px-3 py-1 text-xs font-bold tracking-[0.14em] text-night-pink uppercase">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-night-yellow" />
          Under the hood
        </p>
        <h2 className="mt-6 max-w-4xl font-heading text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.02em]">
          <Words text="A portfolio project," /> <Words text="built like a product." from={3} />
        </h2>
        <p className="np-in-view mt-6 max-w-2xl text-lg text-night-muted" style={revealDelay(250)}>
          Typed end to end, tested on both sides, deployed on free tiers that sleep. The details below are
          the ones worth asking about.
        </p>

        <div className="np-in-view mt-14 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4" style={revealDelay(300)}>
          {STATS.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </div>

        <div ref={grid} className="mt-14 grid gap-4 md:grid-cols-6">
          <Card icon="share" title="Live over WebSockets" className="md:col-span-4">
            <p className={BODY}>
              One connection set per family on FastAPI. An entry is broadcast only after its database commit, and a
              client that drops reconnects with exponential backoff, then refetches.
            </p>
            <SyncDiagram />
          </Card>
          <Card icon="calendar" title="Race-safe writes" className="md:col-span-2" delay={100}>
            <p className={BODY}>Bookings and help-board claims lock the row first, so two taps can&apos;t win the same slot.</p>
            <pre className="mt-auto overflow-x-auto rounded-2xl border border-night-line bg-night p-4 text-xs leading-relaxed text-night-blue">
              <code>{"select(AvailabilitySlot)\n  .where(AvailabilitySlot.id == slot_id)\n  .with_for_update()"}</code>
            </pre>
          </Card>
          <Card icon="shield" title="Real reference data" className="md:col-span-2" delay={0}>
            <p className={BODY}>
              The CDC child schedule (July 2, 2025), WHO LMS growth tables and the published EPDS scoring, with the
              self-harm item handled on the server.
            </p>
          </Card>
          <Card icon="checkCircle" title="Accessible by test" className="md:col-span-2" delay={100}>
            <p className={BODY}>
              Every color pair is checked against WCAG AA in the test suite. Ask your system for reduced motion and
              this whole page holds still.
            </p>
          </Card>
          <Card icon="clock" title="Honest about cold starts" className="md:col-span-2" delay={200}>
            <p className={BODY}>
              The free API and database sleep when idle. The app pings both as soon as a page opens, and says so
              while they wake.
            </p>
          </Card>
          <div className="np-in-view flex flex-col gap-6 rounded-3xl border border-night-line p-6 sm:p-7 md:col-span-6 md:flex-row md:items-center md:justify-between">
            <ul className="flex flex-wrap gap-2">
              {STACK.map((item) => (
                <li key={item} className="rounded-full border border-night-line px-3 py-1 text-sm font-semibold text-on-night">
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="np-cta inline-flex min-h-12 items-center gap-2 rounded-full bg-night-yellow px-6 font-bold text-night"
              >
                Read the code
                <span className="np-nudge inline-flex">
                  <Icon name="arrowRight" className="h-5 w-5" />
                </span>
              </a>
              <a
                href={API_DOCS}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center rounded-full border border-night-line px-6 font-semibold text-on-night hover:bg-night-raised"
              >
                API docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
