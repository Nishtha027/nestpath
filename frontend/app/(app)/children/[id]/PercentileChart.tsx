"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GrowthReferenceRow } from "@/lib/types";

export type ChildPoint = { month: number; value: number; date: string };

// Chart colors come from the design tokens in app/globals.css.
const BAND_OUTER = "var(--np-chart-band-outer)";
const BAND_INNER = "var(--np-chart-band-inner)";
const MEDIAN = "var(--np-chart-median)";
const CHILD = "var(--np-chart-child)";
const GRID = "var(--np-chart-grid)";
const AXIS = "var(--np-chart-axis)";
const SURFACE = "var(--np-surface)";

/** One WHO chart (weight- or length-for-age): the 3rd-97th and 15th-85th
 * percentile bands, the median ("average baby") as a dashed line, and this
 * child's measurements as a connected line of dots. */
export function PercentileChart({
  title,
  unit,
  reference,
  points,
}: {
  title: string;
  unit: string;
  reference: GrowthReferenceRow[];
  points: ChildPoint[];
}) {
  const bands = reference.map((r) => ({
    month: r.month,
    outer: [r.p3, r.p97] as [number, number],
    inner: [r.p15, r.p85] as [number, number],
    median: r.p50,
  }));
  // Fit the y-axis to the curves and the child's points, on round ticks.
  const min = Math.min(...reference.map((r) => r.p3), ...points.map((p) => p.value));
  const max = Math.max(...reference.map((r) => r.p97), ...points.map((p) => p.value));
  const step = max - min > 30 ? 10 : 2;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const yTicks = Array.from({ length: (high - low) / step + 1 }, (_, i) => low + i * step);
  const tick = { fontSize: 12, fill: AXIS };

  return (
    <figure className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm text-muted">{unit}</span>
      </figcaption>
      <div className="h-72 w-full" role="img" aria-label={`${title} chart compared with WHO percentiles`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, 24]}
              ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
              tick={tick}
              stroke={AXIS}
              label={{ value: "Age (months)", position: "insideBottom", offset: -10, fontSize: 12, fill: AXIS }}
            />
            <YAxis
              domain={[low, high]}
              ticks={yTicks}
              tick={tick}
              stroke={AXIS}
              width={44}
              label={{ value: unit, angle: -90, position: "insideLeft", offset: 10, fontSize: 12, fill: AXIS }}
            />
            <Area data={bands} dataKey="outer" stroke="none" fill={BAND_OUTER} fillOpacity={1} isAnimationActive={false} />
            <Area data={bands} dataKey="inner" stroke="none" fill={BAND_INNER} fillOpacity={1} isAnimationActive={false} />
            <Line
              data={bands}
              dataKey="median"
              stroke={MEDIAN}
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              data={points}
              dataKey="value"
              stroke={CHILD}
              strokeWidth={3}
              dot={{ r: 5, fill: CHILD, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 7, fill: CHILD, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                const point = payload?.find((p) => p.dataKey === "value")?.payload as ChildPoint | undefined;
                if (!active || !point) return null;
                return (
                  <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink">
                    {point.date}: {point.value} {unit}
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** The key under the charts, in plain words. */
export function ChartLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink">
      <li className="flex items-center gap-2">
        <svg viewBox="0 0 24 12" aria-hidden="true" className="h-3 w-6">
          <line x1="1" y1="6" x2="23" y2="6" stroke={CHILD} strokeWidth="3" />
          <circle cx="12" cy="6" r="4" fill={CHILD} stroke={SURFACE} strokeWidth="1.5" />
        </svg>
        Your baby
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-block w-6 border-t-2 border-dashed border-chart-median" /> Average
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-block h-3 w-6 rounded-sm bg-chart-band-inner" /> 15th to 85th
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-block h-3 w-6 rounded-sm border border-line bg-chart-band-outer" /> 3rd to 97th
      </li>
    </ul>
  );
}
