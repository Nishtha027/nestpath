"use client";

import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { HelpBoard } from "./HelpBoard";
import { PAGE_TITLE } from "@/lib/ui";

export default function HelpBoardPage() {
  const { caregiver } = useAuth();
  const { token } = useAppState();
  return (
    <section className="flex flex-col gap-5">
      <h1 className={PAGE_TITLE}>Help board</h1>
      {caregiver && <HelpBoard token={token} caregiverId={caregiver.id} />}
    </section>
  );
}
