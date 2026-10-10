"use client";

import { MUTED } from "@/lib/ui";
import { useWakingNote, WAKING_NOTE } from "@/lib/server-wake";
import { Duckling } from "./illustrations";

/** A loading line with the duckling bobbing beside it. The free-tier
 * server can take a while to wake up; if the wait runs long while it does,
 * a second line says why. */
export function Loading({ label = "Loading..." }: { label?: string }) {
  const waking = useWakingNote(true, 4000);
  return (
    <div className="flex items-center gap-3">
      <Duckling animated className="h-12 w-12 shrink-0" />
      <div role="status">
        <p className={MUTED}>{label}</p>
        {waking && <p className={MUTED}>{WAKING_NOTE}</p>}
      </div>
    </div>
  );
}
