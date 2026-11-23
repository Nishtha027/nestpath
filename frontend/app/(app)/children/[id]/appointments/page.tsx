"use client";

import { useAppState, useCurrentChild } from "@/lib/app-state";
import { Appointments } from "../Appointments";
import { PageHeader } from "@/app/ui/PageHeader";

export default function AppointmentsPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Appointments">Book a visit, and print a summary to take to the pediatrician.</PageHeader>
      <Appointments key={child.id} childId={child.id} token={token} />
    </section>
  );
}
