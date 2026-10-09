"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { apiFetch, ApiError } from "@/lib/api";
import type { Alert } from "@/lib/types";
import { MUTED, PAGE_TITLE } from "@/lib/ui";
import { Icon } from "../../ui/Icon";
import { Message } from "../../ui/Message";

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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load alerts. Refresh to try again."))
      .finally(() => setLoading(false));
  }, [token, caregiver?.isProvider]);

  return (
    <>
      <h1 className={PAGE_TITLE}>Alerts</h1>

      {/* There's no UI to grant provider access: set is_provider = true on
          the caregiver's row in the database. */}
      {!caregiver?.isProvider ? (
        <Message tone="error">Alerts are only for provider accounts.</Message>
      ) : (
        <section aria-label="Flagged screenings" className="flex flex-col gap-3">
          <p className={MUTED}>Flagged screenings</p>
          {loading && <p className={MUTED}>Loading...</p>}
          {error && <Message tone="error">{error}</Message>}
          {!loading && !error && alerts.length === 0 && <p className={MUTED}>No flagged screenings.</p>}
          <ul className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded-xl border border-line border-l-4 border-l-danger-ink bg-danger-bg px-4 py-3 text-sm text-ink"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">Score {alert.total_score}</span>
                  <span className="text-xs text-ink">{new Date(alert.created_at).toLocaleString()}</span>
                </div>
                {alert.item_10_flag && (
                  <p className="mt-1.5 flex items-center gap-1.5 font-semibold text-danger-ink">
                    <Icon name="alertTriangle" className="h-4 w-4" />
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
