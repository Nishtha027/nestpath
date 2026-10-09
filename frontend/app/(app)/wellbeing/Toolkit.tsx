"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ScoreBand } from "@/lib/types";
import { toolkitOrder, type ToolkitTool } from "@/lib/wellbeing";
import { BUTTON_PRIMARY, CARD, LINK, MUTED, SECTION_TITLE } from "@/lib/ui";

// --- Breathing pacer -------------------------------------------------------

const PHASES = [
  { label: "Breathe in", seconds: 4, scale: 1 },
  { label: "Hold", seconds: 4, scale: 1 },
  { label: "Breathe out", seconds: 6, scale: 0.55 },
] as const;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true // server: assume reduced, i.e. no animation
  );
}

function BreathingPacer() {
  const reducedMotion = usePrefersReducedMotion();
  const [running, setRunning] = useState(false);
  // Whole seconds since Start; phase, countdown and round all derive from it.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  function toggle() {
    setTick(0);
    setRunning((r) => !r);
  }

  const cycleLength = PHASES.reduce((sum, p) => sum + p.seconds, 0);
  let pos = tick % cycleLength;
  let phase = 0;
  while (pos >= PHASES[phase].seconds) {
    pos -= PHASES[phase].seconds;
    phase += 1;
  }
  const current = PHASES[phase];
  const secondsLeft = current.seconds - pos;
  const cycles = Math.floor(tick / cycleLength);
  // The circle grows while breathing in and shrinks while breathing out,
  // over exactly that phase's length. With reduced motion it stays still
  // and the text countdown carries the pacing.
  const scale = !running ? 0.55 : current.scale;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm">In for 4, hold for 4, out for 6. Stop if you feel light-headed.</p>
      <div className="flex h-44 w-44 items-center justify-center" aria-hidden="true">
        <div
          className="h-40 w-40 rounded-full bg-blue-mid"
          style={{
            transform: reducedMotion ? undefined : `scale(${scale})`,
            transition: reducedMotion ? "none" : `transform ${current.seconds}s ease-in-out`,
          }}
        />
      </div>
      <p className="min-h-7 text-lg font-medium" aria-live="polite">
        {running ? current.label : ""}
      </p>
      {running && (
        <p className={MUTED} aria-hidden="true">
          {secondsLeft} · round {cycles + 1}
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={running}
        className={BUTTON_PRIMARY}
      >
        {running ? "Stop" : "Start"}
      </button>
    </div>
  );
}

// --- Static tools ----------------------------------------------------------

function Grounding() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>When your thoughts race, slowly notice:</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li><strong>5</strong> things you can see</li>
        <li><strong>4</strong> things you can touch or feel</li>
        <li><strong>3</strong> things you can hear</li>
        <li><strong>2</strong> things you can smell</li>
        <li><strong>1</strong> thing you can taste</li>
      </ol>
      <p>It&apos;s fine to do this while holding or feeding the baby.</p>
    </div>
  );
}

const SLEEP_ITEMS = [
  "Take one longer stretch of sleep while someone else covers a feed or a settle.",
  "Nap when you can, even for 20 minutes.",
  "Keep night feeds dim and quiet, and skip screens where you can.",
  "Say no to visitors when you need rest.",
  "Go easy on caffeine later in the day.",
  "If someone offers help, ask them to watch the baby while you sleep.",
];

function SleepChecklist() {
  const [checked, setChecked] = useState<boolean[]>(() => SLEEP_ITEMS.map(() => false));
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-2">
        Pick one or two to try this week. Nothing here is saved.
      </legend>
      {SLEEP_ITEMS.map((text, i) => (
        <label
          key={text}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-page has-checked:bg-blue-soft"
        >
          <input
            type="checkbox"
            checked={checked[i]}
            onChange={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          />
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
}

function AskForHelp() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Try something like:</p>
      <blockquote className="rounded-xl border-l-4 border-primary bg-blue-soft px-4 py-3 text-ink">
        &ldquo;I&apos;ve been finding things hard lately and I&apos;m worn out. Could you take the
        baby on [day/time] so I can sleep / get out for an hour? It would really help.&rdquo;
      </blockquote>
      <ul className="list-disc space-y-1 pl-5">
        <li>Be specific: one task, one time. &ldquo;Can you do Tuesday&apos;s 2am feed?&rdquo;</li>
        <li>Asking for help is part of looking after the baby, not a failure.</li>
      </ul>
      <p>
        Or post a need on the{" "}
        <Link href="/help-board" className={LINK}>
          Help board
        </Link>
        .
      </p>
    </div>
  );
}

function WhenToCall() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        &ldquo;Baby blues&rdquo; (tearful, up-and-down days) are common in the first couple of weeks
        and often ease on their own. Talk to a provider if:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>low mood, worry or numbness lasts more than about two weeks, or keeps getting worse</li>
        <li>you can&apos;t sleep even when you have the chance</li>
        <li>it&apos;s hard to look after yourself or the baby</li>
        <li>you feel panicky, hopeless, or not like yourself</li>
      </ul>
      <p className="font-medium">
        If you have thoughts of harming yourself or your baby, get help right away: call or text
        988, or call 911 in an emergency.
      </p>
    </div>
  );
}

const TOOLS: Record<ToolkitTool, { title: string; render: () => React.ReactNode }> = {
  breathing: { title: "Breathing (4-4-6)", render: () => <BreathingPacer /> },
  grounding: { title: "Grounding (5-4-3-2-1)", render: () => <Grounding /> },
  sleep: { title: "Protect your sleep", render: () => <SleepChecklist /> },
  askForHelp: { title: "Asking for help", render: () => <AskForHelp /> },
  whenToCall: { title: "When to call someone", render: () => <WhenToCall /> },
};

export function Toolkit({ band }: { band: ScoreBand }) {
  return (
    <section aria-labelledby="toolkit-heading" className={CARD}>
      <h2 id="toolkit-heading" className={SECTION_TITLE}>
        Things that may help
      </h2>
      <p className={MUTED}>For the next few days. They don&apos;t replace care from your provider.</p>
      {toolkitOrder(band).map((tool, i) => (
        <details
          key={tool}
          open={i === 0}
          className="rounded-xl border border-line bg-surface open:bg-page"
        >
          <summary className="flex min-h-11 cursor-pointer items-center rounded-xl px-4 font-semibold">
            {TOOLS[tool].title}
          </summary>
          <div className="px-4 pb-4 pt-1">{TOOLS[tool].render()}</div>
        </details>
      ))}
    </section>
  );
}
