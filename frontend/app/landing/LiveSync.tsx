"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { useDemoSteps, useInView } from "./motion";
import { Avatar, Badge, LiveDot, Phone, type Tone } from "./Phone";
import { Eyebrow, Words, revealDelay } from "./Words";

// The script: Sam bumps the bottle to 120 ml, saves, the entry flies over,
// and Rose's phone shows it. Then it starts again.
const IDLE = 0;
const BUMP = 1;
const SAVE = 2;
const SEND = 3;
const SHOWN = 4;
const STEP_MS = [1500, 1100, 750, 1100, 3400];

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "shield",
    title: "Saved, then sent",
    body: "The server broadcasts only after the database commit. Nobody sees an entry that didn't save.",
  },
  {
    icon: "retry",
    title: "Drops heal themselves",
    body: "A lost connection retries with exponential backoff, then refetches, so a missed message never leaves a gap.",
  },
  {
    icon: "list",
    title: "Who did what",
    body: "Every entry carries the name of whoever logged it.",
  },
];

type Geometry = { x: number; y: number; tx: number; ty: number; arc: number };

export function LiveSync() {
  const [stage, inView] = useInView<HTMLDivElement>("-10% 0px");
  const step = useDemoSteps(STEP_MS, inView, SHOWN);
  const save = useRef<HTMLSpanElement>(null);
  const target = useRef<HTMLSpanElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);

  // Where the entry takes off (Sam's Save button) and lands (the top of
  // Rose's list), measured whenever the layout changes.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      if (!save.current || !target.current) return;
      const box = el.getBoundingClientRect();
      const a = save.current.getBoundingClientRect();
      const b = target.current.getBoundingClientRect();
      const x = a.left + a.width / 2 - box.left;
      const y = a.top + a.height / 2 - box.top;
      const tx = b.left + b.width / 2 - box.left - x;
      const ty = b.top + b.height / 2 - box.top - y;
      setGeo({ x, y, tx, ty, arc: Math.max(70, Math.abs(tx) * 0.35) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stage]);

  const packetVars = geo
    ? ({ left: geo.x, top: geo.y, "--tx": `${geo.tx}px`, "--ty": `${geo.ty}px`, "--arc": `${geo.arc}px` } as CSSProperties)
    : undefined;

  return (
    <section id="live" data-reveal className="relative mx-auto grid w-full max-w-6xl scroll-mt-24 items-center gap-14 px-4 py-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:py-36">
      <div className="flex flex-col items-start gap-6">
        <Eyebrow className="np-in-view">Live sync</Eyebrow>
        <h2 className="font-heading text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-ink">
          <span className="block">
            <Words text="Log it once." />
          </span>
          <span className="block">
            <Words text="Everyone sees it." from={3} wordClassName="np-ink-gradient" />
          </span>
        </h2>
        <p className="np-in-view max-w-md text-lg text-muted" style={revealDelay(250)}>
          Sam logs a 3 a.m. bottle. Rose&apos;s phone updates before he&apos;s back in bed. No refresh, no group
          chat, and nobody feeds the baby twice.
        </p>
        <ul className="flex flex-col gap-5 pt-2">
          {POINTS.map((point, i) => (
            <li key={point.title} className="np-in-view flex gap-4" style={revealDelay(350 + i * 120)}>
              <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-soft text-primary-ink">
                <Icon name={point.icon} className="h-5 w-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-bold text-ink">{point.title}</span>
                <span className="text-sm text-muted">{point.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div ref={stage} className="np-in-view-scale relative mx-auto w-full max-w-xl" style={revealDelay(150)}>
        <div aria-hidden="true" className="np-blob np-blob-blue -inset-10 opacity-70" />
        <div className="relative flex items-start">
          <div className="relative z-10 w-[54%] sm:w-[47%]">
            <PhoneLabel name="Sam" tone="pink" text="Sam's phone" />
            <SamPhone step={step} saveRef={save} />
          </div>
          <div className="relative z-20 mt-[30%] -ml-[8%] w-[54%] sm:mt-[16%] sm:ml-[6%] sm:w-[47%]">
            <PhoneLabel name="Rose" tone="blue" text="Rose's phone" />
            <RosePhone step={step} targetRef={target} />
          </div>
        </div>

        {geo && (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
            <path
              d={`M${geo.x} ${geo.y} Q${geo.x + geo.tx / 2} ${geo.y + geo.ty / 2 - geo.arc * 2} ${geo.x + geo.tx} ${geo.y + geo.ty}`}
              fill="none"
              stroke="var(--np-primary)"
              strokeWidth="2"
              strokeDasharray="2 7"
              strokeLinecap="round"
              className={`transition-opacity duration-500 ${step === SEND ? "opacity-60" : "opacity-0"}`}
            />
          </svg>
        )}
        {geo && step === SEND && (
          <span aria-hidden="true" className="np-packet pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2" style={packetVars}>
            <span className="np-packet-arc inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-1.5 text-sm font-bold whitespace-nowrap text-ink shadow-lg">
              <Badge icon="bottle" tone="pink" className="h-7 w-7" />
              120 ml
            </span>
          </span>
        )}
      </div>
    </section>
  );
}

function PhoneLabel({ name, tone, text }: { name: string; tone: Tone; text: string }) {
  return (
    <p className="mb-3 flex items-center gap-2 pl-2 text-sm font-semibold text-muted">
      <Avatar name={name} tone={tone} className="h-7 w-7 text-xs" />
      {text}
    </p>
  );
}

function SamPhone({ step, saveRef }: { step: number; saveRef: RefObject<HTMLSpanElement | null> }) {
  const amount = step >= BUMP ? 120 : 90;
  const saved = step >= SAVE;
  return (
    <Phone label="Sam's phone: logging a 120 ml bottle feed">
      <div className="flex flex-1 flex-col gap-[0.8em] px-[1em] pt-[1em] pb-[1em]">
        <p className="font-heading text-[1.35em] font-semibold">Log</p>
        <Segmented options={["Feed", "Sleep", "Diaper"]} selected={0} />
        <Segmented options={["Breast", "Bottle", "Solids"]} selected={1} small />
        <div className="flex flex-col items-center gap-[0.5em] rounded-[1em] border border-line bg-surface py-[1em]">
          <span className="text-[0.7em] font-bold tracking-wide text-muted uppercase">Amount</span>
          <div className="flex items-center gap-[0.9em]">
            <RoundButton icon="minus" />
            <span key={amount} className={`font-heading text-[2em] leading-none font-semibold tabular-nums ${step === BUMP ? "np-slide-in" : ""}`}>
              {amount}
              <span className="text-[0.5em] text-muted"> ml</span>
            </span>
            <span className="relative">
              <RoundButton icon="plus" />
              {step === BUMP && <Ripple />}
            </span>
          </div>
        </div>
        <div className="flex flex-col divide-y divide-line rounded-[1em] border border-line bg-surface px-[0.9em] text-[0.8em]">
          <FormRow label="When" value="3:02 AM" />
          <FormRow
            label="Unit"
            value={
              <span className="flex rounded-full bg-pink-soft p-[0.2em] text-[0.9em]">
                <span className="rounded-full border border-line bg-surface px-[0.7em] font-bold">ml</span>
                <span className="px-[0.7em] font-semibold text-secondary-ink">oz</span>
              </span>
            }
          />
          <FormRow label="Logged by" value="Sam" />
        </div>
        <div className="mt-auto">
          <span
            ref={saveRef}
            className={`relative flex items-center justify-center gap-[0.4em] overflow-hidden rounded-[0.9em] py-[0.75em] text-[0.95em] font-bold transition-colors duration-300 ${
              saved ? "bg-success-bg text-success-ink" : "bg-primary text-on-primary"
            }`}
          >
            {saved ? (
              <>
                <Icon name="check" className="h-[1.1em] w-[1.1em]" />
                Saved
              </>
            ) : (
              "Save feed"
            )}
            {step === SAVE && <Ripple />}
          </span>
        </div>
      </div>
    </Phone>
  );
}

const ROSE_LIST: { icon: IconName; tone: Tone; what: string; who: string }[] = [
  { icon: "diaper", tone: "green", what: "Wet diaper", who: "Rose · 40 min ago" },
  { icon: "moon", tone: "blue", what: "Nap · 1 h 12 min", who: "Priya · 1 h ago" },
  { icon: "breast", tone: "pink", what: "Left side · 14 min", who: "You · 2 h ago" },
];

function RosePhone({ step, targetRef }: { step: number; targetRef: RefObject<HTMLSpanElement | null> }) {
  const arrived = step >= SHOWN;
  return (
    <Phone label="Rose's phone: the bottle Sam logged appears at once, marked as logged by Sam">
      <div className="relative flex flex-1 flex-col gap-[0.75em] px-[1em] pt-[1em] pb-[1em]">
        {arrived && (
          <div className="np-slide-in absolute inset-x-[0.6em] top-[0.2em] z-10 flex items-center gap-[0.6em] rounded-[1em] border border-line bg-surface/95 p-[0.6em] shadow-lg">
            <Avatar name="Sam" tone="pink" className="h-[2em] w-[2em] text-[0.8em]" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[0.72em] font-bold">Sam logged a feed</span>
              <span className="text-[0.66em] text-muted">Bottle · 120 ml · just now</span>
            </span>
          </div>
        )}
        <p className="font-heading text-[1.35em] font-semibold">Mia&apos;s day</p>
        <div className="flex items-center gap-[0.6em] rounded-[1em] border border-line bg-surface p-[0.7em]">
          <Badge icon={arrived ? "bottle" : "breast"} tone="pink" />
          <span key={arrived ? "new" : "old"} className={`flex flex-col leading-tight ${arrived ? "np-slide-in" : ""}`}>
            <span className="text-[0.66em] text-muted">Last feed</span>
            <span className="text-[0.9em] font-bold">{arrived ? "Bottle · 120 ml" : "Left side · 14 min"}</span>
            <span className="text-[0.66em] text-muted">{arrived ? "just now" : "2 h 5 min ago"}</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-heading text-[0.95em] font-semibold">Today</span>
          <span className="inline-flex items-center gap-[0.4em] rounded-full bg-success-bg px-[0.6em] py-[0.15em] text-[0.68em] font-bold text-success-ink">
            <LiveDot />
            Live
          </span>
        </div>
        <span ref={targetRef} aria-hidden="true" className="-mb-[0.75em] h-0" />
        <ul className="flex flex-col gap-[0.4em]">
          {arrived && (
            <li className="np-arrive flex items-center gap-[0.6em] rounded-[0.85em] border border-line bg-surface px-[0.6em] py-[0.45em]">
              <Badge icon="bottle" tone="pink" className="h-[1.9em] w-[1.9em]" />
              <span className="flex flex-col leading-tight">
                <span className="text-[0.8em] font-bold">Bottle · 120 ml</span>
                <span className="text-[0.66em] text-muted">Sam · just now</span>
              </span>
            </li>
          )}
          {ROSE_LIST.slice(0, arrived ? 2 : 3).map((entry) => (
            <li key={entry.what} className="flex items-center gap-[0.6em] rounded-[0.85em] border border-line bg-surface px-[0.6em] py-[0.45em]">
              <Badge icon={entry.icon} tone={entry.tone} className="h-[1.9em] w-[1.9em]" />
              <span className="flex flex-col leading-tight">
                <span className="text-[0.8em] font-bold">{entry.what}</span>
                <span className="text-[0.66em] text-muted">{entry.who}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Phone>
  );
}

function FormRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="flex items-center justify-between py-[0.65em]">
      <span className="text-muted">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}

function Segmented({ options, selected, small = false }: { options: string[]; selected: number; small?: boolean }) {
  return (
    <div className={`flex gap-[0.25em] rounded-full bg-pink-soft p-[0.25em] ${small ? "text-[0.72em]" : "text-[0.8em]"}`}>
      {options.map((option, i) => (
        <span
          key={option}
          className={`flex-1 rounded-full py-[0.35em] text-center ${
            i === selected ? "border border-line bg-surface font-bold text-ink" : "font-semibold text-secondary-ink"
          }`}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

function RoundButton({ icon }: { icon: IconName }) {
  return (
    <span className="inline-flex h-[2.2em] w-[2.2em] items-center justify-center rounded-full bg-blue-soft text-primary-ink">
      <Icon name={icon} className="h-[1.1em] w-[1.1em]" />
    </span>
  );
}

/** A tap: a ring spreading out from the middle of the thing pressed. */
function Ripple() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="np-tap aspect-square w-[140%] shrink-0 rounded-full bg-ink" />
    </span>
  );
}
