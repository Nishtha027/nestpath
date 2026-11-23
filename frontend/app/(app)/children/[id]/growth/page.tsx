"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { GrowthChart } from "../GrowthChart";
import { PageHeader } from "@/app/ui/PageHeader";

export default function GrowthPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Growth">Weight, length and head size on the WHO growth curves.</PageHeader>
      <GrowthChart key={child.id} childId={child.id} token={token} birthDate={child.birth_date} />
    </section>
  );
}
