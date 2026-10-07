"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { VaccineTimeline } from "../VaccineTimeline";

export default function VaccinesPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Vaccines</h1>
      <VaccineTimeline key={child.id} childId={child.id} token={token} />
    </section>
  );
}
