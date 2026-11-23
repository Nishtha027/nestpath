"use client";

import { useEffect, useRef } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { useMedia } from "./motion";
import { Eyebrow, Words, revealDelay } from "./Words";

type Tone = "paper" | "lime" | "forest" | "peach";

type Moment = { time: string; icon: IconName; title: string; who: string; note: string; tone: Tone };

// One real-looking day, dawn to the 3am feed, each logged by whoever had
// the baby at the time.
const DAY: Moment[] = [
  { time: "06:10", icon: "bottle", title: "Bottle, 120 ml", who: "Sam", note: "On Rose's phone before the kettle boils.", tone: "paper" },
  { time: "08:45", icon: "moon", title: "Nap, 1 h 20 min", who: "Rose", note: "The timer ran while she made breakfast.", tone: "lime" },
  { time: "11:30", icon: "calendar", title: "4-month shots in 4 days", who: "NestPath", note: "Straight from the CDC schedule.", tone: "forest" },
  { time: "14:05", icon: "trendUp", title: "6.4 kg, 50th percentile", who: "Rose, at the clinic", note: "Plotted on the WHO curve.", tone: "peach" },
  { time: "17:40", icon: "heart", title: "Dinner drop-off claimed", who: "Priya", note: "Thursday is covered.", tone: "paper" },
  { time: "21:15", icon: "breast", title: "Left side, 14 min", who: "Sam", note: "Next feed starts on the right.", tone: "lime" },
  { time: "02:50", icon: "diaper", title: "Wet diaper", who: "Sam", note: "Nobody had to ask.", tone: "forest" },
];

const TONE: Record<Tone, { card: string; time: string; meta: string; badge: string }> = {
  paper: { card: "border border-line bg-surface text-ink", time: "np-outline-ink", meta: "text-muted", badge: "bg-blue-soft text-primary-ink" },
  lime: { card: "bg-lime text-ink", time: "np-outline-ink", meta: "text-ink", badge: "bg-primary text-on-primary" },
  forest: { card: "bg-night text-on-night", time: "np-outline-night", meta: "text-night-muted", badge: "bg-night-yellow text-night" },
  peach: { card: "bg-night-pink text-ink", time: "np-outline-ink", meta: "text-ink", badge: "bg-surface text-secondary-ink" },
};

/** "A day with NestPath": on a wide screen the section pins and its cards
 * slide sideways as you scroll down, while a sun rides an arc overhead and
 * turns to a moon for the night feeds. On phones, and with reduced motion,
 * it is a plain row you swipe. */
export function DayScroll() {
  const pinned = useMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const clock = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = section.current;
    const list = track.current;
    if (!pinned || !el || !list) return;
    let dist = 0;
    let frame = 0;
    let shown = -1;

    const update = () => {
      frame = 0;
      const p = dist > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / dist)) : 0;
      el.style.setProperty("--p", p.toFixed(4));
      el.style.setProperty("--arc", (4 * p * (1 - p)).toFixed(4));
      el.toggleAttribute("data-night", p > 0.72);
      const i = Math.round(p * (DAY.length - 1));
      if (i !== shown && clock.current) {
        shown = i;
        clock.current.textContent = DAY[i].time;
      }
    };
    // How far the track has to travel; the section is that much taller than
    // the screen, so scrolling it out takes exactly that long.
    const measure = () => {
      dist = Math.max(0, list.scrollWidth - (list.parentElement?.clientWidth ?? 0));
      el.style.setProperty("--dist", `${dist}px`);
      el.style.height = `calc(100svh + ${dist}px)`;
      update();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(list);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", onScroll);
      for (const prop of ["--p", "--arc", "--dist", "height"]) el.style.removeProperty(prop);
      el.removeAttribute("data-night");
    };
  }, [pinned]);

  return (
    <section ref={section} id="day" aria-labelledby="day-title" className="relative scroll-mt-24">
      <div className={pinned ? "sticky top-0 flex h-svh flex-col justify-center overflow-hidden" : "py-24"}>
        <div data-reveal className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col items-start gap-5">
              <Eyebrow className="np-in-view">A day with NestPath</Eyebrow>
              <h2
                id="day-title"
                className="font-heading text-[clamp(2.4rem,5.5vw,4.4rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-ink"
              >
                <Words text="Twenty-four hours." />{" "}
                <Words text="Three people. One log." from={2} wordClassName="text-primary-ink" />
              </h2>
            </div>
            <p className="np-in-view flex items-baseline gap-3 text-muted" style={revealDelay(200)} aria-hidden="true">
              <span className="text-xs font-bold tracking-[0.2em] uppercase">Now</span>
              <span ref={clock} className="font-heading text-5xl leading-none font-semibold text-ink tabular-nums">
                {pinned ? DAY[0].time : "24 h"}
              </span>
            </p>
          </div>

          {/* The sky: a dotted arc, and the sun (then moon) riding it. */}
          <div aria-hidden="true" className={`np-in-view relative h-14 ${pinned ? "" : "hidden"}`} style={revealDelay(300)}>
            <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <path
                d="M0 20 Q50 -20 100 20"
                fill="none"
                stroke="var(--np-line-strong)"
                strokeWidth="1.5"
                strokeDasharray="2 6"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="np-day-sun absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2">
              <span className="np-day-day absolute inset-0 rounded-full border-2 border-primary bg-lime" />
              <span className="np-day-moon absolute inset-0 flex items-center justify-center rounded-full bg-night text-night-yellow">
                <Icon name="moon" className="h-5 w-5" />
              </span>
            </div>
          </div>
        </div>

        <div className={pinned ? "mt-8" : "mt-10 snap-x snap-mandatory overflow-x-auto pb-4"}>
          <ol
            ref={track}
            className={`flex w-max gap-5 px-4 sm:px-8 ${pinned ? "np-day-track pr-[12vw] lg:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]" : ""}`}
          >
            {DAY.map((m) => {
              const tone = TONE[m.tone];
              return (
                <li
                  key={m.time}
                  className={`flex w-[min(78vw,21rem)] shrink-0 snap-start flex-col gap-5 rounded-[2rem] p-6 sm:p-7 ${tone.card}`}
                >
                  <span className={`np-outline font-heading text-[clamp(3.6rem,7vw,5.4rem)] leading-none font-semibold tabular-nums ${tone.time}`}>
                    {m.time}
                  </span>
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone.badge}`}>
                    <Icon name={m.icon} className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-heading text-2xl leading-tight font-semibold">{m.title}</span>
                    <span className={`text-sm font-semibold ${tone.meta}`}>Logged by {m.who}</span>
                  </span>
                  <span className={`mt-auto border-t pt-4 text-sm ${m.tone === "forest" ? "border-night-line" : "border-current/20"} ${tone.meta}`}>
                    {m.note}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
