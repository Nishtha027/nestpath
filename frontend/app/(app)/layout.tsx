"use client";

import { usePathname } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { AppStateProvider } from "@/lib/app-state";
import { CareFeedProvider } from "@/lib/care-feed";
import { AppNav } from "./AppNav";
import { BottomNav } from "./BottomNav";

// Every logged-in page renders inside this shell: one auth gate (with the
// existing redirect-to-/login and 401 handling from auth-context), one
// child list fetch, the family's live care-log feed, and the persistent
// navigation (top tabs on wider screens, a bottom bar on phones).
//
// Wellbeing (the screening and crisis support) and the provider Alerts list
// are "still" pages: no entrance, hover or idle motion anywhere on them.
const STILL_PAGES = ["/wellbeing", "/alerts"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token, caregiver } = useRequireAuth();
  const pathname = usePathname();
  if (!token || !caregiver) return null;
  const still = STILL_PAGES.some((page) => pathname.startsWith(page));

  return (
    <AppStateProvider key={token} token={token}>
      <CareFeedProvider familyId={caregiver.familyId} token={token}>
        <div className="flex flex-1 flex-col">
          <AppNav />
          <main
            className={`mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10 ${still ? "np-still" : ""}`}
          >
            {children}
          </main>
          <BottomNav />
        </div>
      </CareFeedProvider>
    </AppStateProvider>
  );
}
