"use client";

import { useAuth } from "@/lib/auth-context";
import { useAppState, useCurrentChild } from "@/lib/app-state";
import { LiveCareLog } from "../LiveCareLog";
import { PAGE_TITLE } from "@/lib/ui";

export default function CareLogPage() {
  const { caregiver } = useAuth();
  const { token } = useAppState();
  const child = useCurrentChild();
  if (!caregiver) return null;
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>Care log</h1>
      <LiveCareLog key={child.id} childId={child.id} familyId={caregiver.familyId} token={token} />
    </section>
  );
}
