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

const BAND = "#16a34a";
const CHILD = "#2563eb";

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

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <div className="h-72 w-full" role="img" aria-label={`${title} chart compared with WHO percentiles`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, 24]}
              ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
              tick={{ fontSize: 12 }}
              label={{ value: "Age (months)", position: "insideBottom", offset: -10, fontSize: 12 }}
            />
            <YAxis
              domain={[low, high]}
              ticks={yTicks}
              tick={{ fontSize: 12 }}
              width={44}
              label={{ value: unit, angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
            />
            <Area data={bands} dataKey="outer" stroke="none" fill={BAND} fillOpacity={0.12} isAnimationActive={false} />
            <Area data={bands} dataKey="inner" stroke="none" fill={BAND} fillOpacity={0.22} isAnimationActive={false} />
            <Line
              data={bands}
              dataKey="median"
              stroke={BAND}
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              data={points}
              dataKey="value"
              stroke={CHILD}
              strokeWidth={2}
              dot={{ r: 4, fill: CHILD }}
              isAnimationActive={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                const point = payload?.find((p) => p.dataKey === "value")?.payload as ChildPoint | undefined;
                if (!active || !point) return null;
                return (
                  <div className="rounded border border-black/15 bg-white px-2 py-1 text-xs shadow dark:border-white/20 dark:bg-zinc-900">
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
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-5 bg-blue-600" /> Your baby
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2 border-dashed border-green-600" /> Average baby (WHO median)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 bg-green-600/35" /> Middle 70% of babies (15th-85th)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 bg-green-600/15" /> 94% of babies (3rd-97th)
      </li>
    </ul>
  );
}
