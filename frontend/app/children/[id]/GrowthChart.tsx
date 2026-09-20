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

export function GrowthChart({ childId, token }: { childId: string; token: string }) {
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<GrowthMeasurement[]>(`/children/${childId}/growth`, { token })
      .then(setMeasurements)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load growth data"))
      .finally(() => setLoading(false));
  }, [childId, token]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (measurements.length === 0) {
    return <p className="text-sm text-zinc-500">No growth measurements yet.</p>;
  }

  const data = measurements.map((m) => ({
    date: m.measured_at,
    percentile: Math.round(m.percentile * 10) / 10,
  }));

  return (
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
  );
}
