"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { ageInMonths, comparedToPeers, outsideTypicalRange } from "@/lib/growth";
import type { GrowthMeasurement, GrowthReference } from "@/lib/types";
import { GrowthForm } from "./GrowthForm";
import { ChartLegend, PercentileChart, type ChildPoint } from "./PercentileChart";
import { CARD, MUTED, SECTION_TITLE } from "@/lib/ui";
import { Icon } from "../../../ui/Icon";
import { Disclosure } from "../../../ui/Disclosure";
import { Message } from "../../../ui/Message";
import { Loading } from "../../../ui/Loading";
import { EmptyState } from "../../../ui/EmptyState";
import { BearCub } from "../../../ui/illustrations";

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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load measurements. Refresh to try again."))
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
        if (!cancelled) setReferenceError(err instanceof ApiError ? err.message : "Couldn't load the charts. Refresh to try again.");
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
      <fieldset className="flex flex-wrap items-center gap-2 text-sm">
        <legend className="sr-only">Chart for</legend>
        <span className="mr-1 font-semibold text-muted">WHO charts for</span>
        {(["female", "male"] as const).map((option) => (
          <label
            key={option}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
              sex === option
                ? "border-primary-ink bg-blue-soft font-bold text-primary-ink"
                : "border-line-strong bg-surface font-semibold text-ink hover:bg-page"
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
            {sex === option && <Icon name="check" className="h-4 w-4" />}
            {option === "female" ? "Girls" : "Boys"}
          </label>
        ))}
      </fieldset>

      {overTwo && <Message tone="warning">Charts and new measurements cover 0 to 2 years only.</Message>}

      {loading ? (
        <Loading />
      ) : error ? (
        <Message tone="error">{error}</Message>
      ) : latest ? (
        <LatestSummary measurement={latest} />
      ) : (
        <section className="np-enter rounded-2xl bg-blue-soft">
          <EmptyState art={<BearCub className="h-20 w-20" />} title="No measurements yet">
            Add one below to see the charts.
          </EmptyState>
        </section>
      )}

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>Add a measurement</h2>
        <GrowthForm childId={childId} token={token} birthDate={birthDate} sex={sex} onAdded={loadMeasurements} />
      </section>

      {!sex ? (
        <p className={MUTED}>Choose Girls or Boys to see the charts.</p>
      ) : referenceError ? (
        <Message tone="error">{referenceError}</Message>
      ) : !reference || !curvesMatch ? (
        <Loading label="Loading charts..." />
      ) : (
        <section className="flex flex-col gap-4">
          <ChartLegend />
          <div className="flex flex-col gap-5">
            <PercentileChart title="Weight for age" unit="kg" reference={reference.weight_kg} points={weightPoints} />
            <PercentileChart title="Length for age" unit="cm" reference={reference.length_cm} points={lengthPoints} />
          </div>
          <p className="text-sm text-ink">A steady curve matters more than being on the average line.</p>
          <Disclosure label="About these charts">
            <p>
              Each chart compares your baby with others of the same age and sex. The 50th percentile
              is the average; most babies (94%) fall between the 3rd and 97th.
            </p>
            <p>Babies grow at their own pace. Under age 2, length is measured lying down.</p>
            <p>Source: WHO Child Growth Standards (0 to 24 months), via CDC&apos;s data files.</p>
          </Disclosure>
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
    <section className="flex flex-col gap-1.5 rounded-2xl bg-blue-soft px-5 py-4 text-ink tabular-nums">
      <h2 className="font-semibold">
        Latest · {m.measured_at} · {m.age_months} month{m.age_months === 1 ? "" : "s"}
      </h2>
      {m.weight_kg !== null && m.percentile !== null && (
        <p>
          <strong>{m.weight_kg} kg</strong>, {comparedToPeers(m.percentile, "weight", m.sex)}
        </p>
      )}
      {m.length_cm !== null && m.length_percentile !== null && (
        <p>
          <strong>{m.length_cm} cm</strong>, {comparedToPeers(m.length_percentile, "length", m.sex)}
        </p>
      )}
      {flagged && (
        <Message tone="warning" className="mt-1">
          Outside the usual range (3rd to 97th percentile). Mention it at your next check-up.
        </Message>
      )}
    </section>
  );
}

function MeasurementTable({ measurements }: { measurements: GrowthMeasurement[] }) {
  return (
    <section className={CARD}>
      <h2 className={SECTION_TITLE}>History</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1.5 pr-3 font-semibold">Date</th>
              <th className="py-1.5 pr-3 font-semibold">Age</th>
              <th className="py-1.5 pr-3 font-semibold">Weight</th>
              <th className="py-1.5 pr-3 font-semibold">Length</th>
            </tr>
          </thead>
          <tbody>
            {[...measurements].reverse().map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="py-2 pr-3 whitespace-nowrap">{m.measured_at}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{m.age_months} mo</td>
                <td className="py-2 pr-3">
                  {m.weight_kg !== null && m.percentile !== null ? (
                    <Measure value={`${m.weight_kg} kg`} percentile={m.percentile} />
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-2 pr-3">
                  {m.length_cm !== null && m.length_percentile !== null ? (
                    <Measure value={`${m.length_cm} cm`} percentile={m.length_percentile} />
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** "10.2 kg (49th)"; on a narrow screen the percentile drops under the
 * value instead of the table scrolling sideways. */
function Measure({ value, percentile }: { value: string; percentile: number }) {
  return (
    <>
      <span className="whitespace-nowrap">{value}</span>{" "}
      <span className="whitespace-nowrap text-muted">({ordinal(percentile)})</span>
    </>
  );
}

function ordinal(percentile: number): string {
  const n = Math.round(percentile);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
