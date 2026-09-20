"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { ScheduleItem } from "@/lib/types";

export function VaccineTimeline({ childId, token }: { childId: string; token: string }) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ScheduleItem[]>(`/children/${childId}/schedule`, { token })
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load schedule"))
      .finally(() => setLoading(false));
  }, [childId, token]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-zinc-500">No schedule items yet.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
        >
          <span>
            {item.vaccine_id.toUpperCase()} dose {item.dose_number ?? "?"}
          </span>
          <span className="text-zinc-500">due {item.due_date}</span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              item.status === "given"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            }`}
          >
            {item.status === "given" ? "given" : "pending"}
          </span>
        </li>
      ))}
    </ul>
  );
}
