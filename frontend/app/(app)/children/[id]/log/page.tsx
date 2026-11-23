"use client";

import { useSearchParams } from "next/navigation";
import { useAppState, useCurrentChild } from "@/lib/app-state";
import type { CareLogType } from "@/lib/types";
import { QuickLog } from "./QuickLog";
import { PageHeader } from "@/app/ui/PageHeader";

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
      <PageHeader title="Log">Feeds, sleep, diapers and medicine. Everyone in the family sees it the moment you save.</PageHeader>
      <QuickLog key={child.id} childId={child.id} token={token} initialType={type} />
    </section>
  );
}
