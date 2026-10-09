"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ageLabel, CurrentChildProvider, useAppState } from "@/lib/app-state";
import { LoadError } from "../../LoadError";

// Resolves /children/[id] against the family's child list (there is no
// GET /children/{id}; the list already has everything needed) and makes
// this child the selected one, so the tabs and selector follow the URL.
export default function ChildLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { childList, childrenLoading, childrenError, retryChildren, selectChild } = useAppState();
  const child = childList.find((c) => c.id === id) ?? null;

  useEffect(() => {
    if (child) selectChild(child.id);
  }, [child, selectChild]);

  if (childrenLoading) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>;
  if (childrenError) return <LoadError message={childrenError} onRetry={retryChildren} />;
  if (!child) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        Child not found.{" "}
        <Link href="/dashboard" className="underline">
          Go to Home
        </Link>
      </p>
    );
  }

  return (
    <CurrentChildProvider value={child}>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-black dark:text-white">{child.name || "Unnamed child"}</span>
          {" · "}
          {ageLabel(child.birth_date)} (born {child.birth_date})
        </p>
        {children}
      </div>
    </CurrentChildProvider>
  );
}
