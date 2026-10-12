"use client";

import { useState } from "react";
import Link from "next/link";
import { chartDays, diaperCount, formatDuration, parseDayKey, summaryChips, volumeNumber } from "@/lib/tracker";
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
  const [unit, setUnit] = useVolumeUnit();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-xs">
          <ChoiceGroup legend="Range" hideLegend variant="segment" options={[...RANGES]} value={range} onChange={setRange} />
        </div>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>
      <InsightsBody key={`${childId}-${range}`} childId={childId} token={token} days={range === "7" ? 7 : 30} />
      <p className={MUTED}>Your logged numbers only. Every baby is different, and this is not medical advice.</p>
    </div>
  );
}

function InsightsBody({ childId, token, days }: { childId: string; token: string; days: 7 | 30 }) {
  const { summary, error, retry } = useCareLogSummary(childId, token, days);
  const [unit] = useVolumeUnit();

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
        <p className="text-xs text-muted">
          Averages over the {summary.averages.days_with_entries} day{summary.averages.days_with_entries === 1 ? "" : "s"} with entries.
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <DailyBarChart title="Feeds per day" unit="feeds" data={data} dataKey="feeds" format={String} />
        <DailyBarChart title="Bottle and solids per day" unit={unit} data={data} dataKey="volume" format={(v) => one(v)} />
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

/** Every day's numbers as a table: the charts' data, readable without them.
 * Narrow enough for a phone: the longest sleep sits under the total, and
 * the diaper kinds under the count. */
export function DailyTable({ summary, unit }: { summary: CareLogSummary; unit: "ml" | "oz" }) {
  const sub = "block text-xs text-muted";
  return (
    <table className="w-full text-left text-sm tabular-nums">
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
        {[...summary.daily].reverse().map((d) => {
          const date = parseDayKey(d.day);
          return (
            <tr key={d.day} className="border-t border-line align-top">
              <td className="py-2 pr-2 whitespace-nowrap">
                {date.toLocaleDateString(undefined, { weekday: "short" })}
                <span className={sub}>{date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </td>
              <td className="py-2 pr-2">{d.feeds}</td>
              <td className="py-2 pr-2 whitespace-nowrap">{d.feed_ml > 0 ? `${volumeNumber(d.feed_ml, unit)} ${unit}` : "-"}</td>
              <td className="py-2 pr-2">
                {d.sleep_min > 0 ? formatDuration(d.sleep_min) : "-"}
                {d.longest_sleep_min !== null && <span className={sub}>longest {formatDuration(d.longest_sleep_min)}</span>}
              </td>
              <td className="py-2">
                {diaperCount(d)}
                <span className={sub}>
                  {d.diapers_wet} wet, {d.diapers_dirty} dirty, {d.diapers_both} both
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
