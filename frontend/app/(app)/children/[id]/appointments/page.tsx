"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { Appointments } from "../Appointments";
import { PAGE_TITLE } from "@/lib/ui";

export default function AppointmentsPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>Appointments</h1>
      <Appointments key={child.id} childId={child.id} token={token} />
    </section>
  );
}
