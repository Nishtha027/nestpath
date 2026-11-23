"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { Insights } from "./Insights";
import { PageHeader } from "@/app/ui/PageHeader";

export default function InsightsPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Insights">How feeds, sleep and diapers add up over the last 7 or 30 days.</PageHeader>
      <Insights key={child.id} childId={child.id} token={token} />
    </section>
  );
}
