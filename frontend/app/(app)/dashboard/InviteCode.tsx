"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Family } from "@/lib/types";

export function InviteCode({ token }: { token: string }) {
  const [family, setFamily] = useState<Family | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Family>("/family", { token })
      .then(setFamily)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load invite code"));
  }, [token]);

  return (
    <div className="flex flex-col gap-2 text-sm">
      {error && <p className="text-red-600">{error}</p>}
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
