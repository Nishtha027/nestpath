"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Child } from "@/lib/types";
import { ageLabel, useAppState } from "@/lib/app-state";
import { InviteCode } from "./InviteCode";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function HomePage() {
  const { token, childList, childrenLoading, childrenError, addChild, selectChild } = useAppState();
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
      setCreateError(err instanceof ApiError ? err.message : "Failed to create child");
      setCreating(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Home</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Add a child</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="child-name" className="text-sm text-zinc-600 dark:text-zinc-400">
              Name
            </label>
            <input
              id="child-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={`rounded border border-black/25 px-3 py-2 dark:border-white/30 ${FOCUS}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="child-birth-date" className="text-sm text-zinc-600 dark:text-zinc-400">
              Birth date
            </label>
            <input
              id="child-birth-date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              className={`rounded border border-black/25 px-3 py-2 dark:border-white/30 ${FOCUS}`}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className={`rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black ${FOCUS}`}
          >
            {creating ? "Adding..." : "Add child"}
          </button>
        </form>
        {createError && <p className="text-sm text-red-700 dark:text-red-400">{createError}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Children</h2>
        {childrenLoading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>}
        {childrenError && <p className="text-sm text-red-700 dark:text-red-400">{childrenError}</p>}
        {!childrenLoading && !childrenError && childList.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No children yet -- add one above to see their vaccines, growth, care log and
            appointments.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {childList.map((child) => (
            <li key={child.id}>
              <Link
                href={`/children/${child.id}/vaccines`}
                onClick={() => selectChild(child.id)}
                className={`block rounded border border-black/15 px-4 py-3 hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.05] ${FOCUS}`}
              >
                <span className="font-medium">{child.name || "Unnamed child"}</span>
                <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {ageLabel(child.birth_date)} · born {child.birth_date}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Invite a caregiver</h2>
        <InviteCode token={token} />
      </section>
    </>
  );
}
