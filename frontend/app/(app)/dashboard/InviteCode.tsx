"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { loadErrorMessage, withRetry } from "@/lib/retry";
import type { Family } from "@/lib/types";
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
        if (!cancelled) setError(loadErrorMessage(err, "Failed to load invite code"));
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
    <div className="flex flex-col gap-2 text-sm">
      {error && <LoadError message={error} onRetry={retry} />}
      {family && (
        <>
          <p>
            Invite code:{" "}
            <code
              data-testid="invite-code"
              className="rounded bg-black/[.06] px-2 py-1 font-mono text-base tracking-widest dark:bg-white/[.08]"
            >
              {family.invite_code}
            </code>
          </p>
          <p className="text-zinc-500">
            Share this with another caregiver. On the login page they choose Register, then Join an
            existing family, and enter it to see the same children, care log and help board.
          </p>
        </>
      )}
    </div>
  );
}
