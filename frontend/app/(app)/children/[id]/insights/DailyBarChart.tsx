"use client";

import { useId, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartDay } from "@/lib/tracker";

// The same rules as the growth charts (PercentileChart): colors from the
// design tokens, axis text in the app font at 12px, a caption with the
// unit, no entry animation. Each bar is a single series, so color carries
// no meaning on its own; a week's bars also carry their value, and the
// numbers are in a table under the charts. Today's bar is striped and
// lighter, and its axis label says "Today so far": the day isn't over.
const BAR = "var(--np-chart-median)";
const GRID = "var(--np-chart-grid)";
const AXIS = "var(--np-chart-axis)";
const INK = "var(--np-ink)";
const HOVER = "var(--np-blue-soft)";
const PARTIAL_BG = "var(--np-blue-soft)";

type Key = "feeds" | "volume" | "sleepHours";

export function DailyBarChart({
  title,
  unit,
  data,
  dataKey,
  format,
  action,
}: {
  title: string;
  unit: string;
  data: ChartDay[];
  dataKey: Key;
  format: (value: number) => string;
  /** A control for this chart only, beside the title. */
  action?: ReactNode;
}) {
  const weekly = data.length <= 7;
  const tick = { fontSize: 12, fill: AXIS };
  const hatch = `np-hatch-${useId().replace(/:/g, "")}`;
  // The 30-day axis skips labels, so match today's tick by its label.
  const todayLabel = data.find((d) => d.partial)?.label;
  return (
    <figure className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading text-base font-medium">{title}</span>
        {action ?? <span className="text-sm text-muted">{unit}</span>}
      </figcaption>
      <div className="h-56 w-full" role="img" aria-label={`${title}, per day for ${data.length} days. The numbers are in the table below.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: weekly ? 22 : 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={PARTIAL_BG} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={BAR} strokeWidth="3" />
              </pattern>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              stroke={AXIS}
              tickLine={false}
              height={36}
              interval={weekly ? 0 : "preserveStartEnd"}
              minTickGap={12}
              tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={12} textAnchor="middle" fontSize={tick.fontSize} fill={AXIS}>
                  <tspan x={x} fontWeight={payload.value === todayLabel ? 700 : undefined}>
                    {payload.value}
                  </tspan>
                  {payload.value === todayLabel && (
                    <tspan x={x} dy={14}>
                      so far
                    </tspan>
                  )}
                </text>
              )}
            />
            <YAxis tick={tick} stroke={AXIS} width={36} allowDecimals={dataKey === "sleepHours"} />
            <Bar dataKey={dataKey} fill={BAR} radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false}>
              {data.map((day) => (
                <Cell key={day.day} fill={day.partial ? `url(#${hatch})` : BAR} stroke={day.partial ? BAR : undefined} />
              ))}
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
