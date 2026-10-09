"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import type { GrowthMeasurement } from "@/lib/types";
import { BUTTON_PRIMARY, FIELD, INPUT, LABEL, MUTED } from "@/lib/ui";
import { Message } from "../../../ui/Message";

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
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className={FIELD}>
          <label htmlFor="growth-date" className={LABEL}>Measured on</label>
          <input
            id="growth-date"
            type="date"
            value={measuredAt}
            min={birthDate}
            max={todayISO()}
            onChange={(e) => setMeasuredAt(e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor="growth-weight" className={LABEL}>Weight (kg)</label>
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
            className={`${INPUT} w-28`}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor="growth-length" className={LABEL}>Length / height (cm)</label>
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
            className={`${INPUT} w-32`}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className={BUTTON_PRIMARY}
        >
          {submitting ? "Adding..." : "Add measurement"}
        </button>
      </form>
      <p className={MUTED}>
        Fill in weight, length, or both. Under age 2, length is measured lying down.
      </p>
      {error && <Message tone="error">{error}</Message>}
      {recorded && (
        <Message tone="success">
          Saved the measurement from {recorded.measured_at}. The charts below now include it.
        </Message>
      )}
    </div>
  );
}
