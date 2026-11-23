"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { useCountUp, useDemoSteps, useInView } from "./motion";
import { Avatar, Badge, LiveDot, type Tone } from "./Phone";

// The little demos beside each feature on the landing page. They are
// pictures of the app, not the app: aria-hidden, with the feature's text
// next to them carrying the meaning. One-off animations wait until their
// feature scrolls into view (the [data-reveal] rules in globals.css); the
// looping demos only run while on screen.

const CARD = "np-soft-shadow rounded-3xl border border-line bg-surface p-5 sm:p-6";
const vars = (v: Record<string, string | number>) => v as CSSProperties;

function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={`relative mx-auto w-full max-w-md select-none ${className}`}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- tracker */

const WEEK = [
  { day: "M", feeds: 8 },
  { day: "T", feeds: 7 },
  { day: "W", feeds: 9 },
  { day: "T", feeds: 7 },
  { day: "F", feeds: 8 },
  { day: "S", feeds: 6 },
  { day: "S", feeds: 4, today: true },
];

function Stat({ to, render, label }: { to: number; render: (n: number) => string; label: string }) {
  const [ref, value] = useCountUp(to);
  return (
    <div className="flex flex-col">
      <span ref={ref} className="font-heading text-2xl font-semibold text-ink tabular-nums">
        {render(value)}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

export function TrackerVisual() {
  const max = 10;
  const avg = 7.5;
  return (
    <Frame>
      <div className={CARD}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-lg font-semibold text-ink">Insights</p>
          <span className="flex rounded-full bg-pink-soft p-1 text-xs">
            <span className="rounded-full border border-line bg-surface px-3 py-1 font-bold text-ink">7 days</span>
            <span className="px-3 py-1 font-semibold text-secondary-ink">30 days</span>
          </span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat to={75} render={(n) => (n / 10).toFixed(1)} label="feeds a day" />
          <Stat to={690} render={(n) => `${n} ml`} label="bottle a day" />
          <Stat to={13} render={(n) => `${n} h 40`} label="sleep a day" />
        </div>
        <div className="relative mt-6 flex h-40 items-end gap-2.5 border-b border-line pb-px">
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-chart-median/50"
            style={{ bottom: `${(avg / max) * 100}%` }}
          />
          {WEEK.map((d, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div
                className={`np-bar w-full rounded-t-lg ${d.today ? "np-hatch" : "bg-primary"}`}
                style={vars({ height: `${(d.feeds / max) * 100}%`, "--i": i })}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2.5 text-center text-xs text-muted">
          {WEEK.map((d, i) => (
            <span key={i} className={`flex-1 ${d.today ? "font-bold text-ink" : ""}`}>
              {d.day}
            </span>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="np-hatch inline-block h-3 w-5 rounded-sm" />
          Today, so far. Left out of the average.
        </p>
      </div>
      <div className="np-soft-shadow absolute -top-5 -right-3 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 sm:-right-8">
        <Badge icon="moon" tone="blue" className="h-8 w-8" />
        <span className="flex flex-col leading-tight">
          <span className="text-xs text-muted">Sleep timer</span>
          <span className="text-sm font-bold text-ink tabular-nums">1:12:40</span>
        </span>
      </div>
    </Frame>
  );
}

/* --------------------------------------------------------------- vaccines */

type Dose = { age: string; what: string; status: "done" | "due" | "upcoming" };
const DOSES: Dose[] = [
  { age: "Birth", what: "Hepatitis B", status: "done" },
  { age: "2 months", what: "DTaP, Hib, polio, PCV, rotavirus", status: "done" },
  { age: "4 months", what: "Second doses of the same five", status: "due" },
  { age: "6 months", what: "Third doses, and the first flu shot", status: "upcoming" },
];

function DrawnCheck({ delayMs }: { delayMs: number }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7.5" pathLength={1} className="np-draw" style={{ animationDelay: `${delayMs}ms` }} />
    </svg>
  );
}

export function VaccineVisual() {
  return (
    <Frame>
      <div className={CARD}>
        <p className="font-heading text-lg font-semibold text-ink">Mia&apos;s vaccines</p>
        <ol className="relative mt-4 flex flex-col gap-3">
          <span className="absolute top-4 bottom-4 left-[15px] w-0.5 bg-line" />
          {DOSES.map((dose, i) => (
            <li key={dose.age} className="np-in-view relative flex items-start gap-3" data-reveal style={vars({ "--d": `${200 + i * 140}ms` })}>
              <span
                className={`relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  dose.status === "done"
                    ? "bg-success-bg text-success-ink"
                    : dose.status === "due"
                      ? "bg-info-bg text-info-ink"
                      : "border-2 border-line bg-surface text-muted"
                }`}
              >
                {dose.status === "done" ? (
                  <DrawnCheck delayMs={500 + i * 220} />
                ) : dose.status === "due" ? (
                  <LiveDot className="h-2.5 w-2.5" tone="info" />
                ) : (
                  <Icon name="clock" className="h-4 w-4" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-bold text-ink">{dose.age}</span>
                  {dose.status === "due" && (
                    <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-bold text-info-ink">Due in 4 days</span>
                  )}
                </span>
                <span className="text-sm text-muted">{dose.what}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="np-soft-shadow relative -mt-3 ml-6 flex items-start gap-3 rounded-2xl border border-line bg-neutral-bg p-4 sm:ml-14">
        <Icon name="minusCircle" className="mt-0.5 h-5 w-5 text-neutral-ink" />
        <span className="text-sm text-neutral-ink">
          <span className="font-bold">Rotavirus dose 1 after 15 weeks</span>
          <br />
          No longer recommended at this age. Not &ldquo;overdue&rdquo;.
        </span>
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------------- growth */

// WHO weight-for-age (girls, kg) at 0 to 6 months, and one baby near the
// middle. For the picture only; the app computes the real thing server-side.
const P3 = [2.4, 3.2, 4.0, 4.6, 5.1, 5.5, 5.8];
const P15 = [2.8, 3.6, 4.5, 5.2, 5.7, 6.1, 6.4];
const P50 = [3.2, 4.2, 5.1, 5.8, 6.4, 6.9, 7.3];
const P85 = [3.7, 4.8, 5.9, 6.7, 7.3, 7.8, 8.2];
const P97 = [4.2, 5.4, 6.5, 7.4, 8.1, 8.7, 9.2];
const BABY = [3.3, 4.3, 5.2, 5.9, 6.4];

const W = 320;
const H = 210;
const X0 = 34;
const X1 = 308;
const Y0 = 184;
const Y1 = 14;
const sx = (month: number) => X0 + (month / 6) * (X1 - X0);
const sy = (kg: number) => Y0 - ((kg - 2) / 8) * (Y0 - Y1);
const line = (values: number[]) => values.map((v, m) => `${m ? "L" : "M"}${sx(m).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
const band = (low: number[], high: number[]) =>
  `${line(high)} ${[...low].reverse().map((v, i) => `L${sx(low.length - 1 - i).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ")} Z`;

export function GrowthVisual() {
  const last = BABY.length - 1;
  return (
    <Frame>
      <div className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-heading text-lg font-semibold text-ink">Weight for age</p>
          <span className="text-xs text-muted">WHO, girls</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible">
          {[2, 4, 6, 8, 10].map((kg) => (
            <g key={kg}>
              <line x1={X0} x2={X1} y1={sy(kg)} y2={sy(kg)} stroke="var(--np-chart-grid)" />
              <text x={X0 - 8} y={sy(kg) + 4} textAnchor="end" fontSize="10" fill="var(--np-chart-axis)">
                {kg}
              </text>
            </g>
          ))}
          {[0, 2, 4, 6].map((m) => (
            <text key={m} x={sx(m)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--np-chart-axis)">
              {m} mo
            </text>
          ))}
          <path d={band(P3, P97)} fill="var(--np-chart-band-outer)" />
          <path d={band(P15, P85)} fill="var(--np-chart-band-inner)" />
          <path d={line(P50)} fill="none" stroke="var(--np-chart-median)" strokeWidth="1.5" strokeDasharray="5 5" />
          <path
            d={line(BABY)}
            pathLength={1}
            className="np-draw-slow"
            style={vars({ "--d": "300ms" })}
            fill="none"
            stroke="var(--np-chart-child)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {BABY.map((kg, m) => (
            <circle
              key={m}
              cx={sx(m)}
              cy={sy(kg)}
              r={m === last ? 6 : 4}
              fill="var(--np-chart-child)"
              stroke="var(--np-surface)"
              strokeWidth="2"
              className="np-pop-in"
              style={vars({ "--d": `${450 + m * 380}ms` })}
            />
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded bg-chart-child" /> Mia
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-chart-median" /> Average baby
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-chart-band-inner" /> 15th to 85th
          </span>
        </div>
      </div>
      <div className="np-soft-shadow np-in-view absolute top-16 -right-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 sm:-right-10" data-reveal style={vars({ "--d": "2000ms" })}>
        <p className="text-xs text-muted">4 months</p>
        <p className="font-heading text-xl leading-tight font-semibold text-ink">6.4 kg</p>
        <p className="text-xs font-bold text-secondary-ink">50th percentile</p>
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------- appointments */

const SLOTS = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"];
const TAKEN = 1; // 9:30 was booked before the demo starts
const CONTESTED = 3; // 10:30: both reach for it
const FALLBACK = 4; // 11:00: where the other family ends up

// Centre of each slot in the 3 x 2 grid, in % of the grid.
const slotAt = (i: number) => ({ left: `${(i % 3) * 33.33 + 16.67}%`, top: `${Math.floor(i / 3) * 50 + 25}%` });

const B_STEPS = [1300, 1200, 900, 1700, 1100, 2800];

export function BookingVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const step = useDemoSteps(B_STEPS, inView, 5);
  const youAt = step >= 1 ? slotAt(CONTESTED) : { left: "8%", top: "135%" };
  const themAt = step >= 4 ? slotAt(FALLBACK) : step >= 1 ? slotAt(CONTESTED) : { left: "96%", top: "-30%" };

  const label = (i: number) => {
    if (i === TAKEN) return { text: "Taken", cls: "bg-neutral-bg text-neutral-ink" };
    if (i === CONTESTED && step >= 2) return { text: "Yours", cls: "bg-success-bg text-success-ink ring-2 ring-success-ink" };
    if (i === FALLBACK && step >= 5) return { text: "Theirs", cls: "bg-neutral-bg text-neutral-ink" };
    return { text: "Open", cls: "bg-blue-soft text-primary-ink" };
  };

  return (
    <Frame>
      <div ref={ref} className={CARD}>
        <div className="flex items-center gap-3">
          <Badge icon="calendar" tone="blue" className="h-10 w-10" />
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-lg font-semibold text-ink">Dr. Okafor</span>
            <span className="text-sm text-muted">Pediatrics · Thursday</span>
          </span>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2.5">
          {SLOTS.map((time, i) => {
            const { text, cls } = label(i);
            return (
              <span key={time} className={`flex flex-col items-center rounded-2xl py-2.5 transition-colors duration-300 ${cls}`}>
                <span className="font-bold tabular-nums">{time}</span>
                <span className="text-xs font-semibold">{text}</span>
              </span>
            );
          })}
          <Cursor at={youAt} name="You" tone="blue" clicking={step === 2} />
          <Cursor at={themAt} name="Another family" tone="pink" clicking={step === 3 || step === 5} />
        </div>
        <div className="mt-4 h-11">
          {step === 3 || step === 4 ? (
            <p key="taken" className="np-slide-in flex items-center gap-2 rounded-xl bg-warning-bg px-3 py-2.5 text-sm font-semibold text-warning-ink">
              <Icon name="alertTriangle" className="h-4 w-4" />
              Another family: &ldquo;Just taken. Pick another time.&rdquo;
            </p>
          ) : step >= 2 ? (
            <p key="ok" className="np-slide-in flex items-center gap-2 rounded-xl bg-success-bg px-3 py-2.5 text-sm font-semibold text-success-ink">
              <Icon name="checkCircle" className="h-4 w-4" />
              Booked 10:30, with a 4-month visit checklist
            </p>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}

function Cursor({ at, name, tone, clicking }: { at: { left: string; top: string }; name: string; tone: Tone; clicking: boolean }) {
  return (
    <span className="np-cursor pointer-events-none absolute z-10" style={at}>
      <span className="relative block">
        {clicking && <span className="np-tap absolute -top-4 -left-4 h-8 w-8 rounded-full bg-ink" />}
        <svg viewBox="0 0 20 20" className={`h-5 w-5 ${tone === "blue" ? "text-primary" : "text-secondary-ink"}`}>
          <path d="M2 1.5 17 8.6l-6.4 1.9L7.8 17Z" fill="currentColor" stroke="var(--np-surface)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span
          className={`absolute top-4 left-4 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${
            tone === "blue" ? "bg-primary text-on-primary" : "bg-secondary-bg text-secondary-ink"
          }`}
        >
          {name}
        </span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------- help board */

type Ask = { title: string; when: string; by: string; tone: Tone; claimedBy?: { name: string; tone: Tone; at: number } };
const ASKS: Ask[] = [
  { title: "Drop off dinner", when: "Thu · 6 to 7 pm", by: "You", tone: "blue", claimedBy: { name: "Priya", tone: "green", at: 1 } },
  { title: "Pharmacy pickup", when: "Today · before 5 pm", by: "Rose", tone: "pink" },
  { title: "Walk Biscuit", when: "Sat · morning", by: "You", tone: "blue", claimedBy: { name: "Sam", tone: "pink", at: 2 } },
];
const H_STEPS = [1400, 1700, 3000];

export function HelpVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const step = useDemoSteps(H_STEPS, inView, 2);
  return (
    <Frame>
      <div ref={ref} className="flex flex-col gap-3">
        {ASKS.map((ask, i) => {
          const claimed = ask.claimedBy && step >= ask.claimedBy.at;
          return (
            <div
              key={ask.title}
              className={`np-soft-shadow relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 ${i === 1 ? "sm:ml-10" : i === 2 ? "sm:ml-4" : ""}`}
            >
              <Avatar name={ask.by} tone={ask.tone} className="h-10 w-10 text-sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold text-ink">{ask.title}</span>
                <span className="text-sm text-muted">
                  {ask.when} · {ask.by === "You" ? "your request" : `asked by ${ask.by}`}
                </span>
              </span>
              {claimed && ask.claimedBy ? (
                <span key={`c${step >= ask.claimedBy.at}`} className="np-stamp inline-flex items-center gap-1.5 rounded-xl border-2 border-success-ink bg-success-bg px-2.5 py-1 text-xs font-bold whitespace-nowrap text-success-ink">
                  <Icon name="check" className="h-3.5 w-3.5" />
                  {ask.claimedBy.name}
                </span>
              ) : ask.by === "You" ? (
                <span className="rounded-xl bg-neutral-bg px-2.5 py-1 text-xs font-bold text-neutral-ink">Open</span>
              ) : (
                <span className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-on-primary">Claim</span>
              )}
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------- wellbeing */

// The supplied artwork, shown as it is. This demo never moves: the
// Wellbeing screens in the app are still on purpose, and so is this.
export const CARER_SRC = "/illustrations/hero-mother-child-blue-circle.png";
export const CARER_ALT = "A parent holding their child";
const CARER_SIZE = 626;

const CHECKIN: { icon: IconName; text: string }[] = [
  { icon: "list", text: "Ten questions, a few minutes" },
  { icon: "shield", text: "Scored the published way, not a diagnosis" },
  { icon: "phone", text: "Support lines first when an answer needs it" },
];

export function WellbeingVisual() {
  return (
    <Frame className="np-still">
      <Image
        src={CARER_SRC}
        alt={CARER_ALT}
        width={CARER_SIZE}
        height={CARER_SIZE}
        sizes="(min-width: 1024px) 380px, 80vw"
        className="mx-auto block h-auto w-[82%]"
      />
      <ul className="np-soft-shadow relative -mt-10 flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-5">
        {CHECKIN.map((item) => (
          <li key={item.text} className="flex items-center gap-3 text-sm text-ink">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-soft text-secondary-ink">
              <Icon name={item.icon} className="h-4 w-4" />
            </span>
            {item.text}
          </li>
        ))}
      </ul>
    </Frame>
  );
}
