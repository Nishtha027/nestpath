"use client";

import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { HelpBoard } from "./HelpBoard";
import { PageHeader } from "@/app/ui/PageHeader";

export default function HelpBoardPage() {
  const { caregiver } = useAuth();
  const { token } = useAppState();
  return (
    <section className="flex flex-col gap-5">
      <PageHeader title="Help board">Ask for meals, errands or a hand, and let the family claim them.</PageHeader>
      {caregiver && <HelpBoard token={token} caregiverId={caregiver.id} />}
    </section>
  );
}
