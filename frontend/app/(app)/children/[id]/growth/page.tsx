"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { GrowthChart } from "../GrowthChart";

export default function GrowthPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Growth</h1>
      <GrowthChart key={child.id} childId={child.id} token={token} birthDate={child.birth_date} />
    </section>
  );
}
