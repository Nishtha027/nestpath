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
        <p className="flex items-center gap-3 self-start rounded-full border border-line bg-surface py-1.5 pr-5 pl-1.5 print:hidden">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-lime font-heading text-lg font-semibold text-ink"
          >
            {(child.name || "?").charAt(0).toUpperCase()}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-base font-semibold text-ink">{child.name || "Unnamed child"}</span>
            <span className="text-xs font-semibold text-muted tabular-nums">{ageLabel(child.birth_date)}</span>
          </span>
        </p>
        {children}
      </div>
    </CurrentChildProvider>
  );
}
