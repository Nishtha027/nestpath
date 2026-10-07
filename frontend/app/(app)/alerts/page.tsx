"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { apiFetch, ApiError } from "@/lib/api";
import type { Alert } from "@/lib/types";

export default function AlertsPage() {
  const { caregiver } = useAuth();
  const { token } = useAppState();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caregiver?.isProvider) return;
    apiFetch<Alert[]>("/alerts", { token })
      .then(setAlerts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load alerts"))
      .finally(() => setLoading(false));
  }, [token, caregiver?.isProvider]);

  return (
    <>
      <h1 className="text-xl font-semibold">Alerts</h1>

      {!caregiver?.isProvider ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          This page is only available to provider accounts. There&apos;s no UI to grant provider
          access yet -- set <code>is_provider = true</code> on your caregiver row directly in the
          database.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">High-risk screening flags</h2>
          {loading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>}
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          {!loading && !error && alerts.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No flagged screenings.</p>
          )}
          <ul className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm dark:border-red-800 dark:bg-red-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Score {alert.total_score}</span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
                {alert.item_10_flag && (
                  <p className="mt-1 text-red-900 dark:text-red-200">
                    Item 10 (self-harm) flagged
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
