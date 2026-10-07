"use client";

import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { HelpBoard } from "./HelpBoard";

export default function HelpBoardPage() {
  const { caregiver } = useAuth();
  const { token } = useAppState();
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Help board</h1>
      {caregiver && <HelpBoard token={token} caregiverId={caregiver.id} />}
    </section>
  );
}
