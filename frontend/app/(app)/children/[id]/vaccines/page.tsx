"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { VaccineTimeline } from "../VaccineTimeline";
import { PageHeader } from "@/app/ui/PageHeader";

export default function VaccinesPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Vaccines">The CDC schedule, matched to your baby&apos;s age, with what&apos;s due next.</PageHeader>
      <VaccineTimeline key={child.id} childId={child.id} token={token} />
    </section>
  );
}
