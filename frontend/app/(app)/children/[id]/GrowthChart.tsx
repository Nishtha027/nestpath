"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { ageInMonths, comparedToPeers, outsideTypicalRange } from "@/lib/growth";
import type { GrowthMeasurement, GrowthReference } from "@/lib/types";
import { GrowthForm } from "./GrowthForm";
import { ChartLegend, PercentileChart, type ChildPoint } from "./PercentileChart";

type Sex = "male" | "female";

export function GrowthChart({
  childId,
  token,
  birthDate,
}: {
  childId: string;
  token: string;
  birthDate: string;
}) {
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // WHO has separate charts for girls and boys. Defaults to the sex recorded
  // with the latest measurement; the parent picks it before the first one.
  const [sex, setSex] = useState<Sex | null>(null);
  const [reference, setReference] = useState<GrowthReference | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  function loadMeasurements() {
    apiFetch<GrowthMeasurement[]>(`/children/${childId}/growth`, { token })
      .then((loaded) => {
        setMeasurements(loaded);
        setError(null);
        const latest = loaded.at(-1)?.sex;
        if (latest === "male" || latest === "female") setSex((current) => current ?? latest);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load growth data"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMeasurements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, token]);

  useEffect(() => {
    if (!sex) return;
    let cancelled = false;
    apiFetch<GrowthReference>(`/growth/reference?sex=${sex}`, { token })
      .then((loaded) => {
        if (cancelled) return;
        setReference(loaded);
        setReferenceError(null);
      })
      .catch((err) => {
        if (!cancelled) setReferenceError(err instanceof ApiError ? err.message : "Failed to load WHO curves");
      });
    return () => {
      cancelled = true;
    };
  }, [sex, token]);

  const weightPoints: ChildPoint[] = measurements
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({ month: ageInMonths(birthDate, m.measured_at), value: m.weight_kg!, date: m.measured_at }));
  const lengthPoints: ChildPoint[] = measurements
    .filter((m) => m.length_cm !== null)
    .map((m) => ({ month: ageInMonths(birthDate, m.measured_at), value: m.length_cm!, date: m.measured_at }));
  const latest = measurements.at(-1);
  const curvesMatch = reference?.sex === sex;
  const overTwo = ageInMonths(birthDate, new Date().toISOString().slice(0, 10)) >= 25;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-wrap items-center gap-3 text-sm">
        <legend className="sr-only">Chart for</legend>
        <span className="text-zinc-600 dark:text-zinc-400">WHO charts for</span>
        {(["female", "male"] as const).map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-full border px-3 py-1 ${
              sex === option
                ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200"
                : "border-black/20 dark:border-white/25"
            }`}
          >
            <input
              type="radio"
              name="growth-sex"
              value={option}
              checked={sex === option}
              onChange={() => setSex(option)}
              className="sr-only"
            />
            {option === "female" ? "Girls" : "Boys"}
          </label>
        ))}
      </fieldset>

      {overTwo && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          These charts cover birth to 2 years (WHO&apos;s under-2 standard). Measurements after age 2
          can&apos;t be added here yet.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : latest ? (
        <LatestSummary measurement={latest} />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No measurements yet. Add your baby&apos;s weight and length below to see how they compare
          with WHO growth standards.
        </p>
      )}

      <section className="flex flex-col gap-2 rounded border border-black/10 p-4 dark:border-white/15">
        <h2 className="font-medium">Add a measurement</h2>
        <GrowthForm childId={childId} token={token} birthDate={birthDate} sex={sex} onAdded={loadMeasurements} />
      </section>

      {!sex ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Choose Girls or Boys to see the growth charts.</p>
      ) : referenceError ? (
        <p className="text-sm text-red-600">{referenceError}</p>
      ) : !reference || !curvesMatch ? (
        <p className="text-sm text-zinc-500">Loading charts...</p>
      ) : (
        <section className="flex flex-col gap-4">
          <ChartLegend />
          <div className="grid gap-6 md:grid-cols-2">
            <PercentileChart title="Weight for age" unit="kg" reference={reference.weight_kg} points={weightPoints} />
            <PercentileChart title="Length for age" unit="cm" reference={reference.length_cm} points={lengthPoints} />
          </div>
          <p className="text-xs text-zinc-500">
            Babies grow at their own pace. What matters most is following a steady curve over time,
            not being on the average line. Source: WHO Child Growth Standards (0-24 months), via
            CDC&apos;s data files. This is not medical advice.
          </p>
        </section>
      )}

      {measurements.length > 0 && <MeasurementTable measurements={measurements} />}
    </div>
  );
}

function LatestSummary({ measurement: m }: { measurement: GrowthMeasurement }) {
  const flagged =
    (m.percentile !== null && outsideTypicalRange(m.percentile)) ||
    (m.length_percentile !== null && outsideTypicalRange(m.length_percentile));
  return (
    <section className="flex flex-col gap-1 rounded bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950/60">
      <h2 className="font-medium">
        Latest: {m.measured_at} ({m.age_months} month{m.age_months === 1 ? "" : "s"} old)
      </h2>
      {m.weight_kg !== null && m.percentile !== null && (
        <p>
          <strong>{m.weight_kg} kg</strong>: {comparedToPeers(m.percentile, "weight", m.sex)}{" "}
          <span className="text-zinc-600 dark:text-zinc-400">({ordinal(m.percentile)} percentile)</span>
        </p>
      )}
      {m.length_cm !== null && m.length_percentile !== null && (
        <p>
          <strong>{m.length_cm} cm</strong>: {comparedToPeers(m.length_percentile, "length", m.sex)}{" "}
          <span className="text-zinc-600 dark:text-zinc-400">({ordinal(m.length_percentile)} percentile)</span>
        </p>
      )}
      {flagged && (
        <p className="mt-1 text-amber-900 dark:text-amber-200">
          This is outside the range most babies fall in (3rd-97th percentile). One measurement
          isn&apos;t a diagnosis, but it&apos;s worth mentioning at your next check-up.
        </p>
      )}
    </section>
  );
}

function MeasurementTable({ measurements }: { measurements: GrowthMeasurement[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">All measurements</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-1 pr-3 font-normal">Date</th>
              <th className="py-1 pr-3 font-normal">Age</th>
              <th className="py-1 pr-3 font-normal">Weight</th>
              <th className="py-1 pr-3 font-normal">Length</th>
            </tr>
          </thead>
          <tbody>
            {[...measurements].reverse().map((m) => (
              <tr key={m.id} className="border-t border-black/10 dark:border-white/15">
                <td className="py-1.5 pr-3">{m.measured_at}</td>
                <td className="py-1.5 pr-3">{m.age_months} mo</td>
                <td className="py-1.5 pr-3">
                  {m.weight_kg !== null && m.percentile !== null
                    ? `${m.weight_kg} kg (${ordinal(m.percentile)})`
                    : "-"}
                </td>
                <td className="py-1.5 pr-3">
                  {m.length_cm !== null && m.length_percentile !== null
                    ? `${m.length_cm} cm (${ordinal(m.length_percentile)})`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ordinal(percentile: number): string {
  const n = Math.round(percentile);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
