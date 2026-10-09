"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ageLabel, CurrentChildProvider, useAppState } from "@/lib/app-state";
import { LoadError } from "../../LoadError";
import { Message } from "../../../ui/Message";
import { Loading } from "../../../ui/Loading";

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

  if (childrenLoading) return <Loading />;
  if (childrenError) return <LoadError message={childrenError} onRetry={retryChildren} />;
  if (!child) {
    return (
      <Message tone="error">
        We couldn&apos;t find this child.{" "}
        <Link href="/dashboard" className="font-semibold underline underline-offset-2">
          Go to Home
        </Link>
      </Message>
    );
  }

  return (
    <CurrentChildProvider value={child}>
      <div className="flex flex-col gap-6">
        <p className="self-start rounded-full bg-pink-soft px-4 py-1.5 text-sm text-ink tabular-nums">
          <span className="font-bold">{child.name || "Unnamed child"}</span>
          {" · "}
          {ageLabel(child.birth_date)}
        </p>
        {children}
      </div>
    </CurrentChildProvider>
  );
}
