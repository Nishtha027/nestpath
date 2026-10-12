"use client";

import Link from "next/link";
import { useLatestCareLogs, useNow } from "@/lib/care-feed";
import { entryDetail, entryTitle, formatDuration, formatTimeSince, minutesBetween } from "@/lib/tracker";
import type { CareLog, Child } from "@/lib/types";
import { useVolumeUnit } from "@/lib/volume-unit";
import { SECTION_TITLE } from "@/lib/ui";
import { LoadError } from "../LoadError";
import { TypeBadge } from "../tracker/fields";

type TileType = "feed" | "sleep" | "diaper";

const LABELS: Record<TileType, string> = { feed: "Last feed", sleep: "Last sleep", diaper: "Last diaper" };

/** Home's quick glance: the last feed, sleep and diaper, each with how long
 * ago it was. Kept in step with the live feed, and the "ago" text ticks
 * along on its own. Each tile opens the Log form for that type. */
export function TrackerTiles({ child, token }: { child: Child; token: string }) {
  const { latest, error, retry } = useLatestCareLogs(child.id, token);
  const now = useNow(30_000);
  const [unit] = useVolumeUnit();

  return (
    <section aria-labelledby="tiles-title" className="flex flex-col gap-3">
      <h2 id="tiles-title" className={SECTION_TITLE}>
        {child.name ? `${child.name}'s day` : "Today"}
      </h2>
      {error ? (
        <LoadError message={error} onRetry={retry} withArt={false} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {(["feed", "sleep", "diaper"] as const).map((type) => (
            <li key={type}>
              <Tile
                type={type}
                entry={latest ? latest[type] : undefined}
                href={`/children/${child.id}/log?type=${type}`}
                now={now}
                unit={unit}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tile({
  type,
  entry,
  href,
  now,
  unit,
}: {
  type: TileType;
  /** undefined while loading, null when nothing is logged yet. */
  entry: CareLog | null | undefined;
  href: string;
  now: Date;
  unit: "ml" | "oz";
}) {
  const sleeping = type === "sleep" && entry?.in_progress;
  let main: string;
  let since: string;
  if (entry === undefined) {
    main = "Loading...";
    since = "";
  } else if (entry === null) {
    main = "Nothing yet";
    since = "Tap to log one";
  } else if (sleeping) {
    main = "Sleeping now";
    since = `for ${formatDuration(minutesBetween(entry.occurred_at, now))}`;
  } else {
    const detail = entryDetail(entry, unit, now);
    main = type === "feed" ? `${entryTitle(entry)}${detail ? ` · ${detail}` : ""}` : detail ?? entryTitle(entry);
    // A sleep: time since it ended (when the baby woke).
    since = formatTimeSince(type === "sleep" && entry.ended_at ? entry.ended_at : entry.occurred_at, now);
    if (type === "sleep" && entry.ended_at) since = `Woke ${since.charAt(0).toLowerCase()}${since.slice(1)}`;
  }

  return (
    <Link
      href={href}
      aria-label={`${LABELS[type]}: ${main}${since ? `, ${since}` : ""}. Log a ${type}`}
      className={`np-lift flex min-h-28 items-start gap-3 rounded-2xl border p-4 ${
        sleeping ? "border-primary-ink bg-blue-soft" : "border-line bg-surface hover:bg-page"
      }`}
    >
      <TypeBadge type={type} feedType={entry?.feed_type} size="lg" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold text-muted">{LABELS[type]}</span>
        <span className="font-bold text-ink">{main}</span>
        <span className="text-sm text-ink tabular-nums">{since}</span>
      </span>
    </Link>
  );
}
