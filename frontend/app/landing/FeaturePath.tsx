"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { buildRoute, lengthAtY, pointAtLength, smoothPath, type Sample } from "@/lib/landing-path";
import { LOGIN_HREF, REGISTER_HREF } from "@/lib/welcome";
import { Icon, type IconName } from "../ui/Icon";
import { Chick, Sparkle } from "../ui/illustrations";
import { ChickWalker, Nest } from "../ui/illustrations/ChickWalker";
import { useMagnetic, useReducedMotion } from "./motion";
import { BookingVisual, GrowthVisual, HelpVisual, TrackerVisual, VaccineVisual, WellbeingVisual } from "./StationVisuals";
import { Eyebrow, Words, revealDelay } from "./Words";

type Feature = {
  id: string;
  icon: IconName;
  label: string;
  title: string;
  body: string;
  chips: string[];
  visual: ReactNode;
  /** Wellbeing: nothing here moves, as in the app. */
  still?: boolean;
};

const FEATURES: Feature[] = [
  {
    id: "tracker",
    icon: "bottle",
    label: "Baby tracker",
    title: "Feeds, sleep and diapers in a couple of taps.",
    body: "Run a sleep timer, log a bottle in ml or oz, tap a diaper. History groups it all by day. Insights charts 7 or 30 days, and today stays striped as “so far” so half a day never drags the average down.",
    chips: ["Printable 7-day summary", "Never judges an amount"],
    visual: <TrackerVisual />,
  },
  {
    id: "vaccines",
    icon: "calendar",
    label: "Vaccines",
    title: "The CDC schedule, worked out for your baby.",
    body: "Each dose is due at the recommended age, never before the minimum. Mark one given and the rest of the series re-plans from the real date. Past a hard age limit, a dose says so instead of nagging.",
    chips: ["CDC schedule, July 2025", "Undo the latest dose"],
    visual: <VaccineVisual />,
  },
  {
    id: "growth",
    icon: "trendUp",
    label: "Growth",
    title: "WHO percentiles, without the panic.",
    body: "Weight and length on the WHO bands from birth to 24 months, with a percentile and z-score for every entry. Values WHO would call implausible are turned away, which catches a weight typed in grams.",
    chips: ["Birth to 24 months", "Catches unit mix-ups"],
    visual: <GrowthVisual />,
  },
  {
    id: "appointments",
    icon: "clock",
    label: "Appointments",
    title: "Book a slot. Nobody double-books it.",
    body: "Providers publish their open times. Booking takes a row lock in Postgres, so two families tapping the same slot can’t both get it. Every visit comes with a prep checklist for your baby’s age.",
    chips: ["Row-locked booking", "Visit prep checklist"],
    visual: <BookingVisual />,
  },
  {
    id: "wellbeing",
    icon: "heart",
    label: "Wellbeing",
    title: "A check-in for the parent, too.",
    body: "The Edinburgh Postnatal Depression Scale, scored the published way. If the self-harm question gets any answer but “Never”, the result opens with crisis support, whatever the total. Flagged results reach the care team without names or answers.",
    chips: ["EPDS, 10 questions", "Nothing on these screens moves"],
    visual: <WellbeingVisual />,
    still: true,
  },
  {
    id: "help",
    icon: "message",
    label: "Help board",
    title: "Let the village actually help.",
    body: "Post what you need with a time window, like dinner on Thursday between 6 and 7. Someone in the family claims it. Claims are race-safe, and nobody can claim their own.",
    chips: ["Race-safe claims", "Shared with the family"],
    visual: <HelpVisual />,
  },
];

/** The features, strung along a path that draws itself as you scroll, with
 * the chick walking it from "Day 1" to its nest at the end. */
export function FeaturePath() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<SVGPathElement>(null);
  const drawn = useRef<SVGPathElement>(null);
  const walker = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<{ d: string; w: number; h: number } | null>(null);
  const [resting, setResting] = useState(false);
  const reduce = useReducedMotion();

  // Lay the path through the nodes. Re-measured whenever the section's
  // size changes (fonts arriving, the window resizing, a phone rotating).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const center = (node: Element) => {
        const r = node.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      };
      const start = el.querySelector("[data-path-start]");
      const end = el.querySelector("[data-path-end]");
      if (!start || !end) return;
      const stops = [...el.querySelectorAll<HTMLElement>("[data-station]")].map((station) => {
        const r = station.getBoundingClientRect();
        return { ...center(station.querySelector("[data-node]")!), top: r.top - box.top, bottom: r.bottom - box.top };
      });
      const wide = box.width >= 1024;
      const swing = wide ? Math.min(box.width * 0.3, 330) : 10;
      const d = smoothPath(buildRoute(center(start), stops, center(end), swing));
      setRoute((prev) => (prev && prev.d === d ? prev : { d, w: box.width, h: box.height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tie the drawing and the chick to the scroll position.
  useEffect(() => {
    const el = wrap.current;
    const path = track.current;
    const line = drawn.current;
    const chick = walker.current;
    const end = el?.querySelector<HTMLElement>("[data-path-end]");
    if (!el || !path || !line || !chick || !end || !route) return;

    const nodes = [...el.querySelectorAll<HTMLElement>("[data-node]")];
    if (reduce) {
      line.style.strokeDashoffset = "0";
      nodes.forEach((node) => node.setAttribute("data-passed", ""));
      end.setAttribute("data-home", "");
      return;
    }

    // Sample the path once, so each scroll frame is just two lookups.
    const total = path.getTotalLength();
    const count = Math.min(2400, Math.max(60, Math.ceil(total / 5)));
    const samples: Sample[] = [];
    for (let i = 0; i <= count; i++) {
      const len = (total * i) / count;
      const p = path.getPointAtLength(len);
      samples.push({ len, x: p.x, y: p.y });
    }
    const box0 = el.getBoundingClientRect();
    const nodeLens = nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return lengthAtY(samples, r.top + r.height / 2 - box0.top);
    });
    const calm = el.querySelector<HTMLElement>('[data-station="wellbeing"]');
    const calmBox = calm?.getBoundingClientRect();
    const calmTop = calmBox ? calmBox.top - box0.top : -1;
    const calmBottom = calmBox ? calmBox.bottom - box0.top : -1;

    let frame = 0;
    let idle = 0;
    let lastLen = -1;
    let lastX = 0;
    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const len = lengthAtY(samples, window.innerHeight * 0.58 - box.top);
      const p = pointAtLength(samples, len);
      line.style.strokeDashoffset = String(1 - len / total);
      chick.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (Math.abs(p.x - lastX) > 0.6) chick.toggleAttribute("data-left", p.x < lastX);
      lastX = p.x;
      nodes.forEach((node, i) => node.toggleAttribute("data-passed", len >= nodeLens[i] - 2));
      const home = len >= total - 2;
      chick.toggleAttribute("data-home", home);
      end.toggleAttribute("data-home", home);
      setResting(p.y > calmTop && p.y < calmBottom);
      if (Math.abs(len - lastLen) > 0.5 && lastLen >= 0 && !home) {
        chick.setAttribute("data-walking", "");
        clearTimeout(idle);
        idle = window.setTimeout(() => chick.removeAttribute("data-walking"), 160);
      }
      lastLen = len;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [route, reduce]);

  return (
    <section id="features" className="relative scroll-mt-24 px-4 pt-24 pb-10 sm:px-8 lg:pt-36">
      <div data-reveal className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <Eyebrow className="np-in-view">What&apos;s inside</Eyebrow>
        <h2 className="font-heading text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-ink">
          <Words text="Built for the" />{" "}
          <Words text="first two years." from={3} wordClassName="np-ink-gradient" />
        </h2>
        <p className="np-in-view max-w-xl text-lg text-muted" style={revealDelay(300)}>
          Six tools on one family account. Follow the chick.
        </p>
      </div>

      <div ref={wrap} className="relative isolate mx-auto mt-16 max-w-6xl lg:mt-20">
        {route && (
          <svg
            aria-hidden="true"
            width={route.w}
            height={route.h}
            viewBox={`0 0 ${route.w} ${route.h}`}
            className="pointer-events-none absolute top-0 left-0 -z-10 overflow-visible"
          >
            <defs>
              <linearGradient id="np-path-ink" x1="0" y1="0" x2="0" y2={route.h} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="var(--np-primary)" />
                <stop offset="0.5" stopColor="var(--np-chart-child)" />
                <stop offset="1" stopColor="var(--np-art-sparkle)" />
              </linearGradient>
            </defs>
            <path ref={track} d={route.d} fill="none" stroke="var(--np-blue-mid)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 11" />
            <path
              ref={drawn}
              d={route.d}
              pathLength={1}
              fill="none"
              stroke="url(#np-path-ink)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="1 1"
              style={{ strokeDashoffset: 1 }}
            />
          </svg>
        )}

        <div ref={walker} aria-hidden="true" className="np-walker">
          <div className="-translate-x-1/2 -translate-y-[90%]">
            <div className="np-walker-flip">
              <div className="np-loop-waddle">
                <ChickWalker resting={resting} className="h-14 w-14 lg:h-16 lg:w-16" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-start lg:justify-center">
          <span data-path-start className="relative z-10 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-muted uppercase">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Day 1
          </span>
        </div>

        <div className="mt-28 flex flex-col gap-28 lg:mt-40 lg:gap-56">
          {FEATURES.map((feature, i) => (
            <Station key={feature.id} feature={feature} index={i} />
          ))}
        </div>

        <Finale />
      </div>
    </section>
  );
}

function Station({ feature, index }: { feature: Feature; index: number }) {
  const flip = index % 2 === 1;
  const still = feature.still;
  const text = still ? "" : "np-in-view";
  return (
    <article
      data-station={feature.id}
      data-reveal={still ? undefined : ""}
      aria-labelledby={`feature-${feature.id}`}
      className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] lg:gap-0"
    >
      <span
        data-node
        aria-hidden="true"
        className="np-node absolute top-0 left-0 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-line bg-surface text-muted lg:static lg:col-start-2 lg:row-start-1 lg:h-14 lg:w-14 lg:justify-self-center"
      >
        <Icon name={feature.icon} className="h-5 w-5 lg:h-6 lg:w-6" />
      </span>

      <div className={`flex flex-col items-start gap-4 pl-14 lg:row-start-1 ${flip ? "lg:col-start-3 lg:pl-6" : "lg:col-start-1 lg:pr-6 lg:pl-0"}`}>
        <p className={`${text} text-sm font-bold tracking-[0.14em] text-secondary-ink uppercase`}>
          <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <span className="px-2 text-line-strong">/</span>
          {feature.label}
        </p>
        <h3 id={`feature-${feature.id}`} className="font-heading text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.08] font-semibold text-ink">
          {still ? feature.title : <Words text={feature.title} />}
        </h3>
        <p className={`${text} max-w-lg text-base text-muted sm:text-lg`} style={revealDelay(200)}>
          {feature.body}
        </p>
        <ul className={`${text} flex flex-wrap gap-2 pt-1`} style={revealDelay(320)}>
          {feature.chips.map((chip) => (
            <li key={chip} className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft px-3 py-1 text-sm font-semibold text-primary-ink">
              <Icon name="check" className="h-3.5 w-3.5" />
              {chip}
            </li>
          ))}
        </ul>
      </div>

      <div className={`pl-14 lg:row-start-1 lg:pl-0 ${flip ? "lg:col-start-1" : "lg:col-start-3"}`}>
        <div className={still ? "" : "np-in-view-scale"} style={revealDelay(150)}>
          {feature.visual}
        </div>
      </div>
    </article>
  );
}

const HEARTS = [
  { x: 18, y: 30, d: 0 },
  { x: 86, y: 18, d: 120 },
  { x: 100, y: 62, d: 240 },
  { x: 6, y: 70, d: 180 },
];

/** The end of the path: the nest, where the chick lands, and the last ask. */
function Finale() {
  const primary = useMagnetic<HTMLAnchorElement>(0.3);
  return (
    <div data-reveal className="relative mt-32 flex flex-col items-center gap-6 pb-16 text-center lg:mt-48">
      <div data-path-end className="group relative h-32 w-32">
        <Nest className="absolute inset-0 h-full w-full" />
        <div className="np-home-chick absolute inset-0">
          <Chick animated className="h-full w-full" />
        </div>
        <svg aria-hidden="true" viewBox="0 0 120 120" className="pointer-events-none absolute -inset-8 hidden h-[calc(100%+4rem)] w-[calc(100%+4rem)] overflow-visible group-data-[home]:block">
          {HEARTS.map((h, i) => (
            <Sparkle
              key={i}
              x={h.x}
              y={h.y}
              size={6}
              fill={i % 2 ? "var(--np-art-petal-pink)" : "var(--np-art-petal-blue)"}
              className="np-pop"
              style={{ animationDelay: `${h.d}ms` }}
            />
          ))}
        </svg>
      </div>
      <h2 className="font-heading text-[clamp(2.8rem,8vw,6rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-ink">
        <Words text="Bring the" />{" "}
        <Words text="family in." from={2} wordClassName="np-ink-gradient" />
      </h2>
      <p className="np-in-view max-w-lg text-lg text-muted" style={revealDelay(250)}>
        Start a family, share the invite code, and everyone&apos;s on the same page by the next feed.
      </p>
      <div className="np-in-view flex flex-col items-center gap-3 sm:flex-row" style={revealDelay(400)}>
        <Link
          ref={primary}
          href={REGISTER_HREF}
          className="np-cta np-magnetic inline-flex min-h-14 items-center gap-2 rounded-full bg-primary px-8 text-lg font-bold text-on-primary hover:bg-primary-hover"
        >
          Get started
          <span className="np-nudge inline-flex">
            <Icon name="arrowRight" className="h-5 w-5" />
          </span>
        </Link>
        <Link
          href={LOGIN_HREF}
          className="inline-flex min-h-14 items-center rounded-full border border-line-strong bg-surface px-7 text-base font-semibold text-ink hover:bg-blue-soft"
        >
          I already have an account
        </Link>
      </div>
    </div>
  );
}
