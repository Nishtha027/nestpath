"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartDay } from "@/lib/tracker";

// The same rules as the growth charts (PercentileChart): colors from the
// design tokens, axis text in the app font at 12px, a caption with the
// unit, no entry animation. Each bar is a single series, so color carries
// no meaning on its own; a week's bars also carry their value, and the
// numbers are in a table under the charts.
const BAR = "var(--np-chart-median)";
const GRID = "var(--np-chart-grid)";
const AXIS = "var(--np-chart-axis)";
const INK = "var(--np-ink)";
const HOVER = "var(--np-blue-soft)";

type Key = "feeds" | "volume" | "sleepHours";

export function DailyBarChart({
  title,
  unit,
  data,
  dataKey,
  format,
}: {
  title: string;
  unit: string;
  data: ChartDay[];
  dataKey: Key;
  format: (value: number) => string;
}) {
  const weekly = data.length <= 7;
  const tick = { fontSize: 12, fill: AXIS };
  return (
    <figure className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-base font-medium">{title}</span>
        <span className="text-sm text-muted">{unit}</span>
      </figcaption>
      <div className="h-56 w-full" role="img" aria-label={`${title}, per day for ${data.length} days. The numbers are in the table below.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: weekly ? 22 : 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={tick}
              stroke={AXIS}
              tickLine={false}
              interval={weekly ? 0 : "preserveStartEnd"}
              minTickGap={12}
            />
            <YAxis tick={tick} stroke={AXIS} width={36} allowDecimals={dataKey === "sleepHours"} />
            <Bar dataKey={dataKey} fill={BAR} radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false}>
              {weekly && (
                <LabelList
                  dataKey={dataKey}
                  position="top"
                  formatter={(value) => (Number(value) > 0 ? format(Number(value)) : "")}
                  style={{ fontSize: 12, fill: INK }}
                />
              )}
            </Bar>
            <Tooltip
              cursor={{ fill: HOVER }}
              content={({ active, payload }) => {
                const day = payload?.[0]?.payload as ChartDay | undefined;
                if (!active || !day) return null;
                return (
                  <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink tabular-nums">
                    {day.date}: {format(day[dataKey])}
                  </div>
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
