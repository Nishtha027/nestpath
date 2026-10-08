"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import type { GrowthMeasurement } from "@/lib/types";

export function GrowthForm({
  childId,
  token,
  birthDate,
  sex,
  onAdded,
}: {
  childId: string;
  token: string;
  birthDate: string;
  // Chosen with the Girls/Boys toggle above the form.
  sex: "male" | "female" | null;
  onAdded: () => void;
}) {
  const [measuredAt, setMeasuredAt] = useState(todayISO);
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<GrowthMeasurement | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setRecorded(null);
    if (!sex) {
      setError("Choose Girls or Boys above first: WHO's charts differ by sex.");
      return;
    }
    if (!weightKg && !lengthCm) {
      setError("Enter a weight, a length, or both.");
      return;
    }
    setSubmitting(true);
    try {
      // The server works out the child's age in months from measured_at
      // and their birth date, then looks up the WHO percentiles.
      const measurement = await apiFetch<GrowthMeasurement>(`/children/${childId}/growth`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measured_at: measuredAt,
          sex,
          weight_kg: weightKg ? Number(weightKg) : null,
          length_cm: lengthCm ? Number(lengthCm) : null,
        }),
      });
      setRecorded(measurement);
      setWeightKg("");
      setLengthCm("");
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
          <label htmlFor="growth-date" className="text-xs text-zinc-500">Measured on</label>
          <input
            id="growth-date"
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
          <label htmlFor="growth-weight" className="text-xs text-zinc-500">Weight (kg)</label>
          <input
            id="growth-weight"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.5"
            max="30"
            placeholder="e.g. 7.4"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-28 rounded border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="growth-length" className="text-xs text-zinc-500">Length / height (cm)</label>
          <input
            id="growth-length"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="120"
            placeholder="e.g. 66.5"
            value={lengthCm}
            onChange={(e) => setLengthCm(e.target.value)}
            className="w-32 rounded border px-3 py-2"
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
      <p className="text-xs text-zinc-500">
        Fill in weight, length, or both. Under age 2, length is measured lying down.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {recorded && (
        <p className="text-sm text-green-800 dark:text-green-300">
          Saved the measurement from {recorded.measured_at}. The charts below now include it.
        </p>
      )}
    </div>
  );
}
