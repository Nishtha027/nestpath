"use client";

import { Icon, type IconName } from "../ui/Icon";
import { Chick } from "../ui/illustrations";
import { useInView, useTicker } from "./motion";
import { Avatar, Badge, LiveDot, Phone, type Tone } from "./Phone";

type Entry = { icon: IconName; tone: Tone; what: string; who: string };

// What the family logs while you watch: a new one arrives every few seconds.
const FEED: Entry[] = [
  { icon: "diaper", tone: "green", what: "Wet diaper", who: "Rose" },
  { icon: "bottle", tone: "pink", what: "Bottle · 90 ml", who: "Sam" },
  { icon: "moon", tone: "blue", what: "Nap · 1 h 12 min", who: "Priya" },
  { icon: "breast", tone: "pink", what: "Left side · 14 min", who: "You" },
  { icon: "bowl", tone: "yellow", what: "Solids · pear", who: "Rose" },
  { icon: "diaper", tone: "green", what: "Dirty diaper", who: "Sam" },
];
const AGO = ["just now", "8 min ago", "21 min ago", "46 min ago"];

const SLEEP_START_S = 41 * 60 + 7;
const pad = (n: number) => String(n).padStart(2, "0");

/** The Home screen on a phone, alive: the nap timer runs, and entries from
 * the rest of the family keep arriving at the top of the list. */
export function HeroPhone({ className }: { className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const seconds = useTicker(1000, inView);
  const arrivals = Math.floor(seconds / 4);

  const sleep = SLEEP_START_S + seconds;
  const timer = `${Math.floor(sleep / 60)}:${pad(sleep % 60)}`;
  const shown = [0, 1, 2, 3].map((k) => {
    const n = arrivals - k;
    return { key: n, entry: FEED[((n % FEED.length) + FEED.length) % FEED.length], ago: AGO[k] };
  });

  return (
    <div ref={ref} className={className}>
      <Phone label="NestPath's Home screen: a running nap timer and the family's latest entries arriving live">
        <div className="flex flex-1 flex-col gap-[0.75em] px-[1em] pt-[0.9em] pb-[0.8em]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-[0.35em] font-heading text-[1.05em] font-semibold">
              <Chick className="h-[1.9em] w-[1.9em]" />
              NestPath
            </span>
            <span className="flex -space-x-[0.4em]">
              <Avatar name="Sam" tone="pink" />
              <Avatar name="Rose" tone="blue" />
              <Avatar name="Priya" tone="green" />
            </span>
          </div>

          <div className="relative overflow-hidden rounded-[1em] bg-pink-soft px-[0.9em] py-[0.75em]">
            <p className="font-heading text-[1.2em] leading-tight font-semibold">Good morning</p>
            <p className="text-[0.82em] text-muted">How&apos;s Mia today?</p>
            <Chick animated className="absolute -right-[0.3em] -bottom-[0.5em] h-[3.6em] w-[3.6em]" />
          </div>

          <div className="grid grid-cols-3 gap-[0.45em]">
            <Tile icon="bottle" tone="pink" label="Last feed" value="120 ml" sub="12 min ago" />
            <Tile icon="moon" tone="blue" label="Sleeping" value={timer} sub="since 8:59" />
            <Tile icon="diaper" tone="green" label="Last diaper" value="Wet" sub="38 min ago" />
          </div>

          <div className="flex items-center justify-between pt-[0.2em]">
            <p className="font-heading text-[0.95em] font-semibold">Today</p>
            <span className="inline-flex items-center gap-[0.4em] rounded-full bg-success-bg px-[0.6em] py-[0.15em] text-[0.68em] font-bold text-success-ink">
              <LiveDot />
              Live
            </span>
          </div>
          <ul className="flex flex-col gap-[0.4em]">
            {shown.map(({ key, entry, ago }, k) => (
              <li
                key={key}
                className={`flex items-center gap-[0.6em] rounded-[0.85em] border border-line bg-surface px-[0.6em] py-[0.45em] ${k === 0 && seconds > 0 ? "np-arrive" : ""}`}
              >
                <Badge icon={entry.icon} tone={entry.tone} className="h-[1.9em] w-[1.9em]" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[0.8em] font-bold">{entry.what}</span>
                  <span className="text-[0.66em] text-muted">
                    {entry.who} · {ago}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex items-center justify-around rounded-[1.1em] border border-line bg-surface py-[0.45em] text-muted">
            <Icon name="home" className="h-[1.2em] w-[1.2em] text-primary-ink" />
            <Icon name="list" className="h-[1.2em] w-[1.2em]" />
            <span className="inline-flex h-[2.1em] w-[2.1em] items-center justify-center rounded-full bg-primary text-on-primary">
              <Icon name="plus" className="h-[1.1em] w-[1.1em]" />
            </span>
            <Icon name="barChart" className="h-[1.2em] w-[1.2em]" />
            <Icon name="more" className="h-[1.2em] w-[1.2em]" />
          </div>
        </div>
      </Phone>
    </div>
  );
}

function Tile({ icon, tone, label, value, sub }: { icon: IconName; tone: Tone; label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-[0.3em] rounded-[0.85em] border border-line bg-surface p-[0.5em]">
      <Badge icon={icon} tone={tone} className="h-[1.7em] w-[1.7em]" />
      <span className="text-[0.6em] leading-tight text-muted">{label}</span>
      <span className="text-[0.85em] leading-tight font-bold tabular-nums">{value}</span>
      <span className="text-[0.58em] leading-tight text-muted">{sub}</span>
    </div>
  );
}
