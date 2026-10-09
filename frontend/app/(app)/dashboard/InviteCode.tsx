"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { loadErrorMessage, withRetry } from "@/lib/retry";
import type { Family } from "@/lib/types";
import { MUTED } from "@/lib/ui";
import { LoadError } from "../LoadError";

export function InviteCode({ token }: { token: string }) {
  const [family, setFamily] = useState<Family | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    withRetry(() => apiFetch<Family>("/family", { token }))
      .then((f) => {
        if (!cancelled) setFamily(f);
      })
      .catch((err) => {
        if (!cancelled) setError(loadErrorMessage(err, "Couldn't load the invite code."));
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <LoadError message={error} onRetry={retry} withArt={false} />}
      {family && (
        <>
          <p>
            <code
              data-testid="invite-code"
              className="rounded-xl bg-blue-soft px-3 py-1.5 font-mono text-lg font-semibold tracking-widest text-primary-ink"
            >
              {family.invite_code}
            </code>
          </p>
          <p className={MUTED}>They enter this code when they register.</p>
        </>
      )}
    </div>
  );
}
