"use client";

import { useState } from "react";
import Link from "next/link";
import {
  averagesNote,
  chartDays,
  diaperCount,
  formatDuration,
  isPartialDay,
  parseDayKey,
  summaryChips,
  TODAY_SO_FAR,
  volumeNumber,
} from "@/lib/tracker";
import type { CareLogSummary } from "@/lib/types";
import { useCareLogSummary } from "@/lib/use-summary";
import { useVolumeUnit } from "@/lib/volume-unit";
import { BUTTON_SECONDARY, LINK, MUTED } from "@/lib/ui";
import { Icon } from "../../../../ui/Icon";
import { Loading } from "../../../../ui/Loading";
import { EmptyState } from "../../../../ui/EmptyState";
import { Disclosure } from "../../../../ui/Disclosure";
import { BearCub } from "../../../../ui/illustrations";
import { LoadError } from "../../../LoadError";
import { ChoiceGroup, UnitToggle } from "../../../tracker/fields";
import { DailyBarChart } from "./DailyBarChart";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

/** Numbers only, in neutral words: what was logged, per day. */
export function Insights({ childId, token }: { childId: string; token: string }) {
  const [range, setRange] = useState<"7" | "30">("7");
  return (
    <div className="flex flex-col gap-5">
      <div className="w-full max-w-xs">
        <ChoiceGroup legend="Range" hideLegend variant="segment" options={[...RANGES]} value={range} onChange={setRange} />
      </div>
      <InsightsBody key={`${childId}-${range}`} childId={childId} token={token} days={range === "7" ? 7 : 30} />
      <p className={MUTED}>Your logged numbers only. Not medical advice.</p>
    </div>
  );
}

function InsightsBody({ childId, token, days }: { childId: string; token: string; days: 7 | 30 }) {
  const { summary, error, retry } = useCareLogSummary(childId, token, days);
  const [unit, setUnit] = useVolumeUnit();

  if (error) return <LoadError message={error} onRetry={retry} />;
  if (!summary) return <Loading />;
  if (summary.averages.days_with_entries === 0) {
    return (
      <section className="np-enter rounded-2xl bg-blue-soft">
        <EmptyState art={<BearCub className="h-20 w-20" />} title={`Nothing logged in the last ${days} days`}>
          <Link href={`/children/${childId}/log`} className={LINK}>
            Log a feed, sleep or diaper
          </Link>
        </EmptyState>
      </section>
    );
  }

  const data = chartDays(summary, unit);
  const one = (n: number) => String(Math.round(n * 10) / 10);
  return (
    <>
      <section aria-label="Daily averages" className="flex flex-col gap-2">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {summaryChips(summary, unit).map((chip) => (
            <li key={chip.label} className="np-enter flex flex-col gap-0.5 rounded-2xl bg-pink-soft px-4 py-3">
              <span className="text-xs font-semibold text-muted">{chip.label}</span>
              <span className="text-lg font-bold text-ink tabular-nums">{chip.value}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{averagesNote(summary)}</p>
      </section>

      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-xs text-muted">
          <span aria-hidden="true" className="np-hatch inline-block h-3 w-5 rounded-sm border border-chart-median" />
          Striped bar: today so far. The day isn&apos;t over yet.
        </p>
        <DailyBarChart title="Feeds per day" unit="feeds" data={data} dataKey="feeds" format={String} />
        <DailyBarChart
          title="Bottle and solids per day"
          unit={unit}
          data={data}
          dataKey="volume"
          format={(v) => one(v)}
          action={<UnitToggle unit={unit} onChange={setUnit} />}
        />
        <DailyBarChart title="Sleep per day" unit="hours" data={data} dataKey="sleepHours" format={(v) => one(v)} />
      </div>

      <Disclosure label="Daily numbers">
        <DailyTable summary={summary} unit={unit} />
      </Disclosure>

      <Link href={`/children/${childId}/share`} className={`self-start ${BUTTON_SECONDARY}`}>
        <Icon name="share" className="h-4 w-4" />
        Share with pediatrician
      </Link>
    </>
  );
}

/** Every day's numbers: cards on a phone, a table from 640px up and on
 * paper. Newest first; today is labelled "Today so far". */
export function DailyTable({ summary, unit }: { summary: CareLogSummary; unit: "ml" | "oz" }) {
  const sub = "block text-xs text-muted";
  const days = [...summary.daily].reverse().map((d) => {
    const date = parseDayKey(d.day);
    const partial = isPartialDay(summary, d.day);
    return {
      d,
      partial,
      weekday: partial ? TODAY_SO_FAR : date.toLocaleDateString(undefined, { weekday: "short" }),
      date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      amount: d.feed_ml > 0 ? `${volumeNumber(d.feed_ml, unit)} ${unit}` : "-",
      sleep: d.sleep_min > 0 ? formatDuration(d.sleep_min) : "-",
      longest: d.longest_sleep_min !== null ? `longest ${formatDuration(d.longest_sleep_min)}` : null,
      diapers: `${d.diapers_wet} wet, ${d.diapers_dirty} dirty, ${d.diapers_both} both`,
    };
  });
  return (
    <>
      <ul className="flex flex-col gap-2 sm:hidden print:hidden">
        {days.map((row) => (
          <li
            key={row.d.day}
            className={`flex flex-col gap-2 rounded-xl border p-3 tabular-nums ${row.partial ? "border-dashed border-line-strong" : "border-line"}`}
          >
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-ink">{row.weekday}</span>
              <span className="text-xs text-muted">{row.date}</span>
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Feeds</dt>
                <dd className="text-ink">
                  {row.d.feeds}
                  {row.amount !== "-" && <span className="text-muted"> · {row.amount}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Sleep</dt>
                <dd className="text-ink">
                  {row.sleep}
                  {row.longest && <span className={sub}>{row.longest}</span>}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted">Diapers</dt>
                <dd className="text-ink">
                  {diaperCount(row.d)}
                  <span className="text-muted"> · {row.diapers}</span>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm tabular-nums sm:table print:table">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1.5 pr-2 font-semibold">Day</th>
            <th className="py-1.5 pr-2 font-semibold">Feeds</th>
            <th className="py-1.5 pr-2 font-semibold">Amount</th>
            <th className="py-1.5 pr-2 font-semibold">Sleep</th>
            <th className="py-1.5 font-semibold">Diapers</th>
          </tr>
        </thead>
        <tbody>
          {days.map((row) => (
            <tr key={row.d.day} className="border-t border-line align-top">
              <td className={`py-2 pr-2 whitespace-nowrap ${row.partial ? "font-bold" : ""}`}>
                {row.weekday}
                <span className={`${sub} font-normal`}>{row.date}</span>
              </td>
              <td className="py-2 pr-2">{row.d.feeds}</td>
              <td className="py-2 pr-2 whitespace-nowrap">{row.amount}</td>
              <td className="py-2 pr-2">
                {row.sleep}
                {row.longest && <span className={sub}>{row.longest}</span>}
              </td>
              <td className="py-2">
                {diaperCount(row.d)}
                <span className={sub}>{row.diapers}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
