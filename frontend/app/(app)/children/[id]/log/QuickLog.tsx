"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useLatestCareLogs, useNow } from "@/lib/care-feed";
import {
  draftPayload,
  entryDetail,
  entryTitle,
  formatClock,
  formatDuration,
  loggedBy,
  minutesBetween,
  newDraft,
  normalizeEntry,
  validateDraft,
  type Draft,
} from "@/lib/tracker";
import type { CareLog, CareLogType } from "@/lib/types";
import { useVolumeUnit } from "@/lib/volume-unit";
import { BUTTON_PRIMARY, CARD, MUTED, SUBSECTION_TITLE } from "@/lib/ui";
import { Icon } from "../../../../ui/Icon";
import { Message } from "../../../../ui/Message";
import { Loading } from "../../../../ui/Loading";
import { LoadError } from "../../../LoadError";
import {
  ChoiceGroup,
  DiaperFields,
  FeedFields,
  NotesField,
  SleepRangeFields,
  TimeField,
  TYPE_OPTIONS,
  TypeBadge,
} from "../../../tracker/fields";

const SAVE_BUTTON = `${BUTTON_PRIMARY} min-h-14 w-full text-base`;

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

/** Quick Log: Feed, Sleep, Diaper (and Medicine). Big targets, sensible
 * defaults, one Save. Every caregiver in the family sees the entry at once
 * (the API broadcasts it over the live feed). */
export function QuickLog({ childId, token, initialType }: { childId: string; token: string; initialType: CareLogType }) {
  const router = useRouter();
  const [type, setType] = useState<CareLogType>(initialType);
  const latest = useLatestCareLogs(childId, token);
  const [saved, setSaved] = useState<CareLog | null>(null);

  function changeType(next: CareLogType) {
    setType(next);
    setSaved(null);
    // Keep the address in step, so Back and a refresh land on the same form.
    router.replace(`/children/${childId}/log?type=${next}`, { scroll: false });
  }

  function onSaved(entry: CareLog) {
    const normalized = normalizeEntry(entry);
    setSaved(normalized);
    latest.apply({ kind: "upsert", entry: normalized });
  }

  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup legend="What to log" hideLegend variant="segment" options={TYPE_OPTIONS} value={type} onChange={changeType} />

      {type === "sleep" ? (
        <SleepLog
          key={childId}
          childId={childId}
          token={token}
          latest={latest}
          onSaved={onSaved}
        />
      ) : (
        // A fresh form per type (and per child).
        <EntryForm key={`${childId}-${type}`} childId={childId} token={token} type={type} onSaved={onSaved} />
      )}

      <div role="status" aria-live="polite">
        {saved && <SavedNote entry={saved} childId={childId} />}
      </div>
    </div>
  );
}

function SavedNote({ entry, childId }: { entry: CareLog; childId: string }) {
  const [unit] = useVolumeUnit();
  const now = useNow();
  const detail = entryDetail(entry, unit, now);
  const what = entry.type === "sleep" && entry.in_progress ? "Sleep timer started" : `${entryTitle(entry)}${detail ? `, ${detail}` : ""}`;
  return (
    <Message tone="success" className="np-enter">
      <span className="font-semibold">Saved.</span> {what} at {formatClock(entry.occurred_at)}.{" "}
      <Link href={`/children/${childId}/history`} className="font-semibold underline underline-offset-2">
        See History
      </Link>
    </Message>
  );
}

function EntryForm({
  childId,
  token,
  type,
  onSaved,
}: {
  childId: string;
  token: string;
  type: CareLogType;
  onSaved: (entry: CareLog) => void;
}) {
  const [unit, setUnit] = useVolumeUnit();
  const [draft, setDraft] = useState<Draft>(() => newDraft(type));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateDraft(draft, new Date());
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await apiFetch<CareLog>(`/children/${childId}/care-logs`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload(draft, "create")),
      });
      onSaved(created);
      // Ready for the next one: same choices, time back to now, no note.
      setDraft((d) => ({ ...d, occurredAt: "", notes: "" }));
    } catch (err) {
      setError(errorText(err, "Couldn't save. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={CARD}>
      {type === "feed" && <FeedFields draft={draft} onChange={setDraft} unit={unit} onUnitChange={setUnit} />}
      {type === "diaper" && <DiaperFields draft={draft} onChange={setDraft} />}
      <TimeField label="Time" value={draft.occurredAt} onChange={(occurredAt) => setDraft({ ...draft, occurredAt })} allowNow />
      <NotesField value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} />
      {error && <Message tone="error">{error}</Message>}
      <button type="submit" disabled={saving} className={SAVE_BUTTON}>
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

/** Sleep: a timer (start now, stop now) and, below it, a past sleep. */
function SleepLog({
  childId,
  token,
  latest,
  onSaved,
}: {
  childId: string;
  token: string;
  latest: ReturnType<typeof useLatestCareLogs>;
  onSaved: (entry: CareLog) => void;
}) {
  const now = useNow(15_000);
  const [busy, setBusy] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const running = latest.latest?.sleep?.in_progress ? latest.latest.sleep : null;

  async function start() {
    setBusy(true);
    setTimerError(null);
    try {
      const created = await apiFetch<CareLog>(`/children/${childId}/care-logs`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sleep", in_progress: true }),
      });
      onSaved(created);
    } catch (err) {
      setTimerError(errorText(err, "Couldn't start the timer. Try again."));
      // Someone else may have started one (409): show theirs.
      if (err instanceof ApiError && err.status === 409) latest.retry();
    } finally {
      setBusy(false);
    }
  }

  async function stop(entry: CareLog) {
    setBusy(true);
    setTimerError(null);
    try {
      const updated = await apiFetch<CareLog>(`/children/${childId}/care-logs/${entry.id}`, {
        token,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // The start time is the server's clock and this is the phone's: a
        // timer stopped right after starting (or a phone clock a little
        // behind) must still end after it started.
        body: JSON.stringify({
          ended_at: new Date(Math.max(Date.now(), new Date(entry.occurred_at).getTime() + 60_000)).toISOString(),
        }),
      });
      onSaved(updated);
    } catch (err) {
      setTimerError(errorText(err, "Couldn't stop the timer. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={`${CARD} items-stretch`} aria-label="Sleep timer">
        {latest.error ? (
          <LoadError message={latest.error} onRetry={latest.retry} withArt={false} />
        ) : latest.loading ? (
          <Loading />
        ) : running ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-blue-soft px-4 py-3 text-ink">
              <TypeBadge type="sleep" size="lg" />
              <div className="min-w-0 tabular-nums">
                <p className="font-bold">Sleeping for {formatDuration(minutesBetween(running.occurred_at, now))}</p>
                <p className="text-sm">
                  Since {formatClock(running.occurred_at)} · started by {loggedBy(running)}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => stop(running)} disabled={busy} className={SAVE_BUTTON}>
              <Icon name="stop" />
              {busy ? "Stopping..." : "Stop now"}
            </button>
          </>
        ) : (
          <button type="button" onClick={start} disabled={busy} className={SAVE_BUTTON}>
            <Icon name="play" />
            {busy ? "Starting..." : "Start sleep now"}
          </button>
        )}
        {timerError && <Message tone="error">{timerError}</Message>}
      </section>

      <PastSleepForm childId={childId} token={token} onSaved={onSaved} />
    </>
  );
}

function PastSleepForm({ childId, token, onSaved }: { childId: string; token: string; onSaved: (entry: CareLog) => void }) {
  const [draft, setDraft] = useState<Draft>(() => newDraft("sleep"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateDraft(draft, new Date());
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await apiFetch<CareLog>(`/children/${childId}/care-logs`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload(draft, "create")),
      });
      onSaved(created);
      setDraft(newDraft("sleep"));
    } catch (err) {
      setError(errorText(err, "Couldn't save. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={CARD}>
      <div className="flex flex-col gap-0.5">
        <h2 className={SUBSECTION_TITLE}>Add a past sleep</h2>
        <p className={MUTED}>For a nap you didn&apos;t time.</p>
      </div>
      <SleepRangeFields draft={draft} onChange={setDraft} />
      <NotesField value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} />
      {error && <Message tone="error">{error}</Message>}
      <button type="submit" disabled={saving} className={`${BUTTON_PRIMARY} min-h-12 w-full`}>
        {saving ? "Saving..." : "Save sleep"}
      </button>
    </form>
  );
}

