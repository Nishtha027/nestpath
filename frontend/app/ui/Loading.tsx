import { MUTED } from "@/lib/ui";
import { Duckling } from "./illustrations";

/** A loading line with the duckling bobbing beside it. The free-tier
 * server can take a while to wake up, so this may stay up for some time. */
export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Duckling animated className="h-12 w-12 shrink-0" />
      <p className={MUTED}>{label}</p>
    </div>
  );
}
