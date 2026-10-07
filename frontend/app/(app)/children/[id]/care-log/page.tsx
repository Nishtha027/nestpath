"use client";

import { useAuth } from "@/lib/auth-context";
import { useAppState, useCurrentChild } from "@/lib/app-state";
import { LiveCareLog } from "../LiveCareLog";

export default function CareLogPage() {
  const { caregiver } = useAuth();
  const { token } = useAppState();
  const child = useCurrentChild();
  if (!caregiver) return null;
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Care log (live)</h1>
      <LiveCareLog key={child.id} childId={child.id} familyId={caregiver.familyId} token={token} />
    </section>
  );
}
