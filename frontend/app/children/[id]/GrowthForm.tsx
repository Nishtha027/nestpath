"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import type { GrowthMeasurement } from "@/lib/types";

export function GrowthForm({
  childId,
  token,
  birthDate,
  onAdded,
}: {
  childId: string;
  token: string;
  birthDate: string;
  onAdded: () => void;
}) {
  const [measuredAt, setMeasuredAt] = useState(todayISO);
  const [sex, setSex] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<GrowthMeasurement | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setRecorded(null);
    setSubmitting(true);
    try {
      // The server works out the child's age in months from measured_at
      // and their birth date, then looks up the WHO percentile.
      const measurement = await apiFetch<GrowthMeasurement>(`/children/${childId}/growth`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measured_at: measuredAt, sex, weight_kg: Number(weightKg) }),
      });
      setRecorded(measurement);
      setWeightKg("");
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add measurement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Measured on</label>
          <input
            type="date"
            value={measuredAt}
            min={birthDate}
            max={todayISO()}
            onChange={(e) => setMeasuredAt(e.target.value)}
            required
            className="rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Sex</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            required
            className="rounded border px-3 py-2"
          >
            <option value="">Select...</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Weight (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
            className="w-28 rounded border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Adding..." : "Add measurement"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {recorded && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Recorded {recorded.weight_kg} kg at {recorded.age_months} month
          {recorded.age_months === 1 ? "" : "s"} old: weight-for-age percentile{" "}
          {recorded.percentile.toFixed(1)} (z-score {recorded.z_score.toFixed(2)}).
        </p>
      )}
    </div>
  );
}
