"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Child } from "@/lib/types";

export default function DashboardPage() {
  const { token, caregiver, logout } = useRequireAuth();
  const router = useRouter();

  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<Child[]>("/children", { token })
      .then(setChildren)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Failed to load children"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreateError(null);
    setCreating(true);
    try {
      const child = await apiFetch<Child>("/children", {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, birth_date: birthDate }),
      });
      setChildren((prev) => [...prev, child]);
      setName("");
      setBirthDate("");
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create child");
    } finally {
      setCreating(false);
    }
  }

  if (!token) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8 font-sans">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">NestPath</h1>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>{caregiver?.email}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="rounded bg-black/[.06] px-3 py-1 dark:bg-white/[.08]"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Add a child</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Birth date</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              className="rounded border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {creating ? "Adding..." : "Add child"}
          </button>
        </form>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Children</h2>
        {loading && <p className="text-sm text-zinc-500">Loading...</p>}
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {!loading && !loadError && children.length === 0 && (
          <p className="text-sm text-zinc-500">No children yet -- add one above.</p>
        )}
        <ul className="flex flex-col gap-2">
          {children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/children/${child.id}`}
                className="block rounded border px-4 py-3 hover:bg-black/[.03] dark:hover:bg-white/[.05]"
              >
                <span className="font-medium">{child.name || "Unnamed child"}</span>
                <span className="ml-2 text-sm text-zinc-500">born {child.birth_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
