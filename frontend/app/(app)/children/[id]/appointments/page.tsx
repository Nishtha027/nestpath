"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { Appointments } from "../Appointments";

export default function AppointmentsPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Appointments</h1>
      <Appointments key={child.id} childId={child.id} token={token} />
    </section>
  );
}
