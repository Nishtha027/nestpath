"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch, ApiError } from "@/lib/api";
import type { GrowthMeasurement } from "@/lib/types";
import { GrowthForm } from "./GrowthForm";

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

  function loadMeasurements() {
    apiFetch<GrowthMeasurement[]>(`/children/${childId}/growth`, { token })
      .then((loaded) => {
        setMeasurements(loaded);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load growth data"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMeasurements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, token]);

  const data = measurements.map((m) => ({
    date: m.measured_at,
    percentile: Math.round(m.percentile * 10) / 10,
  }));

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : measurements.length === 0 ? (
        <p className="text-sm text-zinc-500">No growth measurements yet.</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="percentile" stroke="#2563eb" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <GrowthForm childId={childId} token={token} birthDate={birthDate} onAdded={loadMeasurements} />
    </div>
  );
}
