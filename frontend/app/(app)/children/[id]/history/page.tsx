"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { PAGE_TITLE } from "@/lib/ui";
import { History } from "./History";

export default function HistoryPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>History</h1>
      <History key={child.id} childId={child.id} token={token} />
    </section>
  );
}
