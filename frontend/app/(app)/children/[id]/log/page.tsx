"use client";

import { useSearchParams } from "next/navigation";
import { useAppState, useCurrentChild } from "@/lib/app-state";
import type { CareLogType } from "@/lib/types";
import { PAGE_TITLE } from "@/lib/ui";
import { QuickLog } from "./QuickLog";

const TYPES: CareLogType[] = ["feed", "sleep", "diaper", "medication"];

// /children/{id}/log?type=feed|sleep|diaper|medication (Home's tiles open
// the matching form).
export default function LogPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  const requested = useSearchParams().get("type");
  const type = TYPES.find((t) => t === requested) ?? "feed";
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>Log</h1>
      <QuickLog key={child.id} childId={child.id} token={token} initialType={type} />
    </section>
  );
}
