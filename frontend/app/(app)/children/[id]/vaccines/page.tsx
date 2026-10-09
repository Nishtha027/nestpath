"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { VaccineTimeline } from "../VaccineTimeline";
import { PAGE_TITLE } from "@/lib/ui";

export default function VaccinesPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>Vaccines</h1>
      <VaccineTimeline key={child.id} childId={child.id} token={token} />
    </section>
  );
}
