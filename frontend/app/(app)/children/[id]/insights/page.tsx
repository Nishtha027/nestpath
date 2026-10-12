"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { PAGE_TITLE } from "@/lib/ui";
import { Insights } from "./Insights";

export default function InsightsPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>Insights</h1>
      <Insights key={child.id} childId={child.id} token={token} />
    </section>
  );
}
