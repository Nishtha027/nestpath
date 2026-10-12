"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";
import { loadErrorMessage, withRetry } from "./retry";
import { browserTimeZone } from "./tracker";
import type { CareLogSummary } from "./types";

/** GET /children/{id}/care-logs/summary for the last `days` days, with day
 * boundaries in the browser's timezone. */
export function useCareLogSummary(childId: string, token: string, days: 7 | 30) {
  const [summary, setSummary] = useState<CareLogSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ days: String(days), tz: browserTimeZone() });
    withRetry(() => apiFetch<CareLogSummary>(`/children/${childId}/care-logs/summary?${params}`, { token }))
      .then((loaded) => {
        if (cancelled) return;
        setSummary(loaded);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(loadErrorMessage(err, "Couldn't load the summary."));
      });
    return () => {
      cancelled = true;
    };
  }, [childId, token, days, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setSummary(null);
    setAttempt((n) => n + 1);
  }, []);

  return { summary, error, retry };
}
