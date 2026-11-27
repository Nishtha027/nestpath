"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Child } from "@/lib/types";
import { ageLabel, useAppState } from "@/lib/app-state";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, FIELD, INPUT, LABEL, SECTION_TITLE } from "@/lib/ui";
import { Message } from "../../ui/Message";
import { Loading } from "../../ui/Loading";
import { Chick } from "../../ui/illustrations";
import { Icon, type IconName } from "../../ui/Icon";
import { InviteCode } from "./InviteCode";
import { TrackerTiles } from "./TrackerTiles";
import { LoadError } from "../LoadError";

function timeOfDayGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The top of Home: a forest band like the landing hero, with the greeting
 * (the page title), the date, and one-tap links to log the three things
 * families log most. */
function Greeting({ child, ready }: { child: Child | null; ready: boolean }) {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const name = child?.name || "your baby";
  return (
    <section className="np-enter np-night np-grain relative isolate overflow-hidden rounded-[2rem] bg-night px-6 py-7 text-on-night sm:px-9 sm:py-9">
      <div aria-hidden="true" className="np-dots-night absolute inset-0 -z-10" />
      <div aria-hidden="true" className="np-blob np-blob-lime np-loop-blob -top-32 -right-24 -z-10 h-80 w-80 opacity-30" />
      <div
        aria-hidden="true"
        className="np-blob np-blob-pink np-loop-blob np-loop-minor -bottom-36 left-10 -z-10 h-72 w-72 opacity-20"
        style={{ animationDelay: "-7s" }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-bold tracking-[0.2em] text-night-muted uppercase">{date}</p>
          <h1 className="font-heading text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[0.98] font-semibold tracking-[-0.03em]">
            {timeOfDayGreeting(now.getHours())}.
            {ready && (
              <span className="block text-night-yellow">
                {child ? `How's ${name} today?` : "Add your baby to start."}
              </span>
            )}
          </h1>
        </div>
        <Chick animated className="h-20 w-20 shrink-0 sm:h-28 sm:w-28" />
      </div>
      {child && (
        <ul className="mt-7 flex flex-wrap gap-2">
          {QUICK.map((q, i) => (
            <li key={q.type}>
              <Link
                href={`/children/${child.id}/log?type=${q.type}`}
                className={`np-press inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-bold ${
                  i === 0
                    ? "bg-night-yellow text-night hover:bg-night-blue"
                    : "border border-night-line text-on-night hover:border-night-yellow hover:text-night-yellow"
                }`}
              >
                <Icon name={q.icon} className="h-5 w-5" />
                {q.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const QUICK: { type: string; label: string; icon: IconName }[] = [
  { type: "feed", label: "Log a feed", icon: "bottle" },
  { type: "sleep", label: "Sleep", icon: "moon" },
  { type: "diaper", label: "Diaper", icon: "diaper" },
];

function AddChildForm({
  onSubmit,
  name,
  setName,
  birthDate,
  setBirthDate,
  creating,
}: {
  onSubmit: (e: FormEvent) => void;
  name: string;
  setName: (v: string) => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  creating: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className={`${FIELD} min-w-0 flex-1 basis-48`}>
        <label htmlFor="child-name" className={LABEL}>
          Name
        </label>
        <input
          id="child-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={INPUT}
        />
      </div>
      <div className={`${FIELD} min-w-0 flex-1 basis-40`}>
        <label htmlFor="child-birth-date" className={LABEL}>
          Birth date
        </label>
        <input
          id="child-birth-date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
          className={INPUT}
        />
      </div>
      <button type="submit" disabled={creating} className={BUTTON_PRIMARY}>
        {creating ? "Adding..." : "Add child"}
      </button>
    </form>
  );
}

export default function HomePage() {
  const {
    token,
    childList,
    childrenLoading,
    childrenError,
    retryChildren,
    addChild,
    selectChild,
    selectedChild,
  } = useAppState();
  const router = useRouter();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const child = await apiFetch<Child>("/children", {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birth_date: birthDate }),
      });
      addChild(child);
      selectChild(child.id);
      router.push(`/children/${child.id}/vaccines`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Couldn't add the child. Try again.");
      setCreating(false);
    }
  }

  const ready = !childrenLoading && !childrenError;

  // A family with no child yet fills in the baby's basics first (/setup),
  // then lands back here.
  const needsSetup = ready && childList.length === 0;
  useEffect(() => {
    if (needsSetup) router.replace("/setup");
  }, [needsSetup, router]);
  const form = (
    <AddChildForm
      onSubmit={handleCreate}
      name={name}
      setName={setName}
      birthDate={birthDate}
      setBirthDate={setBirthDate}
      creating={creating}
    />
  );

  return (
    <>
      <Greeting child={selectedChild} ready={ready} />

      {childrenLoading && <Loading />}
      {childrenError && <LoadError message={childrenError} onRetry={retryChildren} />}

      {selectedChild && <TrackerTiles key={selectedChild.id} child={selectedChild} token={token} />}

      {childList.length > 0 && (
        <section aria-label="Children" className="flex flex-col gap-2">
          {childList.length > 1 && <h2 className={SECTION_TITLE}>Children</h2>}
          <ul className="flex flex-col gap-2">
            {childList.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/children/${child.id}/vaccines`}
                  onClick={() => selectChild(child.id)}
                  className="np-lift np-card np-cta flex min-h-11 items-center gap-4 rounded-[1.5rem] border border-line bg-surface px-4 py-4 transition-colors hover:bg-blue-soft sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime font-heading text-xl font-semibold text-ink"
                  >
                    {(child.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-heading text-xl font-semibold text-ink">{child.name || "Unnamed child"}</span>
                    <span className="text-sm text-muted tabular-nums">
                      {ageLabel(child.birth_date)} · born {child.birth_date}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
                  >
                    <span className="np-nudge inline-flex">
                      <Icon name="arrowRight" className="h-5 w-5" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready && childList.length === 0 && (
        <section className={CARD}>
          <h2 className={SECTION_TITLE}>Add your baby</h2>
          {form}
          {createError && <Message tone="error">{createError}</Message>}
        </section>
      )}
      {childList.length > 0 && (
        <details className="group">
          <summary className={`${BUTTON_SECONDARY} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            Add another child
          </summary>
          <div className={`${CARD} mt-3`}>
            {form}
            {createError && <Message tone="error">{createError}</Message>}
          </div>
        </details>
      )}

      <section className="np-enter np-card np-grain relative isolate flex flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-lime p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className={SECTION_TITLE}>Invite a caregiver</h2>
            <p className="text-sm text-ink">Partner, grandparent or nanny: everyone logs to the same timeline.</p>
          </div>
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
          >
            <Icon name="share" className="h-5 w-5" />
          </span>
        </div>
        <InviteCode token={token} />
      </section>
    </>
  );
}
