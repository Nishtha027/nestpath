"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { History } from "./History";
import { PageHeader } from "@/app/ui/PageHeader";

export default function HistoryPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="History">Every entry, grouped by day, with who logged it.</PageHeader>
      <History key={child.id} childId={child.id} token={token} />
    </section>
  );
}
