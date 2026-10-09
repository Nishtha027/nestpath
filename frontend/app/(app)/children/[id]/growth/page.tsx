"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { GrowthChart } from "../GrowthChart";
import { PAGE_TITLE } from "@/lib/ui";

export default function GrowthPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>Growth</h1>
      <GrowthChart key={child.id} childId={child.id} token={token} birthDate={child.birth_date} />
    </section>
  );
}
