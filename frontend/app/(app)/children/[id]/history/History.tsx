"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useCareFeed, useCareLogList, useNow, type FeedStatus } from "@/lib/care-feed";
import {
  draftFromEntry,
  draftPayload,
  entrySummary,
  entryTitle,
  formatClock,
  groupByDay,
  loggedBy,
  normalizeEntry,
  validateDraft,
  type CareEvent,
  type Draft,
} from "@/lib/tracker";
import type { CareLog, CareLogType } from "@/lib/types";
import { useVolumeUnit } from "@/lib/volume-unit";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LINK, MUTED } from "@/lib/ui";
import { Icon } from "../../../../ui/Icon";
import { Message } from "../../../../ui/Message";
import { Loading } from "../../../../ui/Loading";
import { EmptyState } from "../../../../ui/EmptyState";
import { Sheet, type SheetHandle } from "../../../../ui/Sheet";
import { Bunny } from "../../../../ui/illustrations";
import { LoadError } from "../../../LoadError";
import { ChoiceGroup, EntryFields, TypeBadge } from "../../../tracker/fields";

type Filter = "all" | Exclude<CareLogType, "medication">;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "feed", label: "Feed" },
  { value: "sleep", label: "Sleep" },
  { value: "diaper", label: "Diaper" },
];

export function History({ childId, token }: { childId: string; token: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { status } = useCareFeed();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChoiceGroup legend="Show" hideLegend variant="chip" options={FILTERS} value={filter} onChange={setFilter} />
        <LiveStatus status={status} />
      </div>
      {/* Keyed by filter: each filter loads its own list. */}
      <Timeline key={`${childId}-${filter}`} childId={childId} token={token} type={filter === "all" ? null : filter} />
    </div>
  );
}

function LiveStatus({ status }: { status: FeedStatus }) {
  return (
    <p
      className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm text-muted ring-1 ring-line"
      data-testid="connection-status"
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${
          status === "connected" ? "bg-success-ink" : status === "rejected" ? "bg-danger-ink" : "border-2 border-muted"
        }`}
      />
      {status === "connected" && "Live"}
      {status === "connecting" && "Connecting..."}
      {status === "reconnecting" && "Reconnecting..."}
      {status === "rejected" && <span className="font-semibold text-danger-ink">Disconnected. Log in again.</span>}
    </p>
  );
}

function Timeline({ childId, token, type }: { childId: string; token: string; type: CareLogType | null }) {
  const list = useCareLogList(childId, token, type);
  const now = useNow();
  const [unit] = useVolumeUnit();
  const [editing, setEditing] = useState<CareLog | null>(null);
  // Counts openings, so every opening starts a fresh form (even for the
  // same entry, and even if the sheet's close event hasn't arrived yet).
  const [opened, setOpened] = useState(0);
  const sheet = useRef<SheetHandle>(null);

  function open(entry: CareLog) {
    setEditing(entry);
    setOpened((n) => n + 1);
    sheet.current?.open();
  }

  if (list.loading) return <Loading />;
  if (list.error) return <LoadError message={list.error} onRetry={list.retry} />;

  const groups = groupByDay(list.entries, now);
  return (
    <>
      {groups.length === 0 ? (
        <section className="np-enter rounded-2xl bg-blue-soft">
          <EmptyState art={<Bunny animated className="h-20 w-20" />} title={type ? `No ${type} entries yet` : "No entries yet"}>
            <Link href={`/children/${childId}/log${type ? `?type=${type}` : ""}`} className={LINK}>
              Log one now
            </Link>
          </EmptyState>
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted">{group.label}</h2>
              <ul className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <li key={entry.id} className={list.arrivedIds.has(entry.id) ? "np-arrive rounded-xl" : ""}>
                    <EntryRow entry={entry} summary={entrySummary(entry, unit, now)} onOpen={() => open(entry)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {list.moreError && <Message tone="error">{list.moreError}</Message>}
          {list.hasMore && (
            <button type="button" onClick={list.loadMore} disabled={list.loadingMore} className={`self-center ${BUTTON_SECONDARY}`}>
              {list.loadingMore ? "Loading..." : "Show older entries"}
            </button>
          )}
        </div>
      )}

      <Sheet ref={sheet} title={editing ? `Edit ${entryTitle(editing).toLowerCase()}` : "Edit"} onClose={() => setEditing(null)}>
        {editing && (
          <EditEntry
            key={`${editing.id}-${opened}`}
            childId={childId}
            token={token}
            entry={editing}
            onDone={(event) => {
              list.applyLocal(event);
              sheet.current?.close();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function EntryRow({ entry, summary, onOpen }: { entry: CareLog; summary: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${summary}, ${formatClock(entry.occurred_at)}, by ${loggedBy(entry)}. Edit`}
      className="np-press flex w-full items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:bg-page"
    >
      <TypeBadge type={entry.type} feedType={entry.feed_type} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold text-ink tabular-nums">{summary}</span>
        {entry.notes && <span className="text-sm break-words text-ink">{entry.notes}</span>}
        <span className="text-xs text-muted">by {loggedBy(entry)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted tabular-nums">
        {formatClock(entry.occurred_at)}
        <Icon name="pencil" className="h-4 w-4" />
      </span>
    </button>
  );
}

function EditEntry({
  childId,
  token,
  entry,
  onDone,
}: {
  childId: string;
  token: string;
  entry: CareLog;
  onDone: (event: CareEvent) => void;
}) {
  const [unit, setUnit] = useVolumeUnit();
  const [draft, setDraft] = useState<Draft>(() => draftFromEntry(entry));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const path = `/children/${childId}/care-logs/${entry.id}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    const problem = validateDraft(draft, new Date());
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<CareLog>(path, {
        token,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload(draft, "edit")),
      });
      setBusy(false);
      onDone({ kind: "upsert", entry: normalizeEntry(updated) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<void>(path, { token, method: "DELETE" });
      onDone({ kind: "deleted", id: entry.id, childId });
    } catch (err) {
      // Already gone (someone else deleted it): that's what was wanted.
      if (err instanceof ApiError && err.status === 404) {
        onDone({ kind: "deleted", id: entry.id, childId });
        return;
      }
      setError(err instanceof ApiError ? err.message : "Couldn't delete. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      <p className={MUTED}>Logged by {loggedBy(entry)}</p>
      <EntryFields draft={draft} onChange={setDraft} unit={unit} onUnitChange={setUnit} />
      {error && <Message tone="error">{error}</Message>}
      {confirming ? (
        <div role="alertdialog" aria-label="Delete this entry?" className="flex flex-col gap-3 rounded-2xl bg-danger-bg p-4">
          <p className="font-semibold text-danger-ink">Delete this entry? This can&apos;t be undone.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="np-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger-ink px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              <Icon name="trash" className="h-4 w-4" />
              {busy ? "Deleting..." : "Delete"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={BUTTON_SECONDARY}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="np-press inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-danger-ink hover:bg-danger-bg"
          >
            <Icon name="trash" className="h-4 w-4" />
            Delete
          </button>
          <button type="submit" disabled={busy} className={`${BUTTON_PRIMARY} min-w-32`}>
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </form>
  );
}
