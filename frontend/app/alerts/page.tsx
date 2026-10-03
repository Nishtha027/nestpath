"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Alert } from "@/lib/types";

export default function AlertsPage() {
  const { token, caregiver, logout } = useRequireAuth();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !caregiver?.isProvider) return;
    apiFetch<Alert[]>("/alerts", { token })
      .then(setAlerts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load alerts"))
      .finally(() => setLoading(false));
  }, [token, caregiver?.isProvider]);

  if (!token) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8 font-sans">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Alerts</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>{caregiver?.email}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded bg-black/[.06] px-3 py-1 dark:bg-white/[.08]"
          >
            Log out
          </button>
        </div>
      </header>

      {!caregiver?.isProvider ? (
        <p className="text-sm text-red-600">
          This page is only available to provider accounts. There&apos;s no UI to grant provider
          access yet -- set <code>is_provider = true</code> on your caregiver row directly in the
          database.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">High-risk screening flags</h2>
          {loading && <p className="text-sm text-zinc-500">Loading...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && alerts.length === 0 && (
            <p className="text-sm text-zinc-500">No flagged screenings.</p>
          )}
          <ul className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm dark:border-red-800 dark:bg-red-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Score {alert.total_score}</span>
                  <span className="text-xs text-zinc-500">
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
    </main>
  );
}
