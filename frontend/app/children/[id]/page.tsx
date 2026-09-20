"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { Child } from "@/lib/types";
import { VaccineTimeline } from "./VaccineTimeline";
import { GrowthChart } from "./GrowthChart";
import { LiveCareLog } from "./LiveCareLog";

export default function ChildDetailPage() {
  const { token, caregiver, logout } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const childId = params.id;

  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    // No GET /children/{id} endpoint exists -- the family's child list
    // already has everything this page needs to display.
    apiFetch<Child[]>("/children", { token })
      .then((children) => {
        const found = children.find((c) => c.id === childId) ?? null;
        setChild(found);
        if (!found) setError("Child not found");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load child"))
      .finally(() => setLoading(false));
  }, [token, childId]);

  if (!token) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8 font-sans">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">
            {loading ? "Loading..." : child?.name || "Unnamed child"}
          </h1>
        </div>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && child && caregiver && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Vaccine timeline</h2>
            <VaccineTimeline childId={childId} token={token} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Growth</h2>
            <GrowthChart childId={childId} token={token} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Care log (live)</h2>
            <LiveCareLog childId={childId} familyId={caregiver.familyId} token={token} />
          </section>
        </>
      )}
    </main>
  );
}
