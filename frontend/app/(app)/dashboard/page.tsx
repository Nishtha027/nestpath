"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Child } from "@/lib/types";
import { ageLabel, useAppState } from "@/lib/app-state";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, FIELD, INPUT, LABEL, PAGE_TITLE, SECTION_TITLE } from "@/lib/ui";
import { Message } from "../../ui/Message";
import { Loading } from "../../ui/Loading";
import { Chick } from "../../ui/illustrations";
import { InviteCode } from "./InviteCode";
import { LoadError } from "../LoadError";

function timeOfDayGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** A warm hello at the top of Home (the page title), using the selected
 * child's name. */
function Greeting({ child, ready }: { child: Child | null; ready: boolean }) {
  return (
    <section className="np-enter flex items-center gap-4 rounded-2xl bg-pink-soft px-5 py-4">
      <Chick animated className="h-20 w-20 shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className={PAGE_TITLE}>{timeOfDayGreeting(new Date().getHours())}</h1>
        {ready && (
          <p className="text-ink">
            {child ? `How's ${child.name || "your baby"} today?` : "Add your baby to get started."}
          </p>
        )}
      </div>
    </section>
  );
}

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

      {childList.length > 0 && (
        <section aria-label="Children" className="flex flex-col gap-2">
          {childList.length > 1 && <h2 className={SECTION_TITLE}>Children</h2>}
          <ul className="flex flex-col gap-2">
            {childList.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/children/${child.id}/vaccines`}
                  onClick={() => selectChild(child.id)}
                  className="np-lift flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-2xl border border-line bg-surface px-5 py-4 transition-colors hover:bg-blue-soft"
                >
                  <span className="text-lg font-bold text-ink">{child.name || "Unnamed child"}</span>
                  <span className="text-sm text-muted">
                    {ageLabel(child.birth_date)} · born {child.birth_date}
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

      <section className={CARD}>
        <h2 className={SECTION_TITLE}>Invite a caregiver</h2>
        <InviteCode token={token} />
      </section>
    </>
  );
}
