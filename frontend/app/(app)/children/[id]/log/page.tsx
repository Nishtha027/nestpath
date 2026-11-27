"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAppState, useCurrentChild } from "@/lib/app-state";
import type { CareLogType } from "@/lib/types";
import { SECTION_TITLE } from "@/lib/ui";
import { QuickLog } from "./QuickLog";
import { Insights } from "../insights/Insights";
import { PageHeader } from "@/app/ui/PageHeader";
import { Icon } from "@/app/ui/Icon";

const TYPES: CareLogType[] = ["feed", "sleep", "diaper", "medication"];

// /children/{id}/log?type=feed|sleep|diaper|medication (Home's tiles open
// the matching form). Insights sit under the form on the same page, at
// #insights (the old /insights address redirects there).
export default function LogPage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  const requested = useSearchParams().get("type");
  const type = TYPES.find((t) => t === requested) ?? "feed";

  // Arriving at #insights (an old Insights link, or "show insights" by
  // voice): the form above finishes loading after the browser jumps, which
  // pushes the charts down, so line the heading up again once it settles.
  useEffect(() => {
    if (window.location.hash !== "#insights") return;
    const timer = window.setTimeout(() => document.getElementById("insights")?.scrollIntoView({ block: "start" }), 700);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader title="Log">Feeds, sleep, diapers and medicine. Everyone in the family sees it the moment you save.</PageHeader>
          <a
            href="#insights"
            className="np-cta inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-primary px-4 text-sm font-bold text-primary-ink hover:bg-blue-soft"
          >
            <Icon name="barChart" className="h-4 w-4" />
            See insights
            <span className="np-nudge inline-flex rotate-90">
              <Icon name="arrowRight" className="h-4 w-4" />
            </span>
          </a>
        </div>
        <QuickLog key={child.id} childId={child.id} token={token} initialType={type} />
      </section>

      <section id="insights" aria-labelledby="insights-title" className="flex scroll-mt-40 flex-col gap-5 border-t border-line pt-8">
        <header className="flex flex-col gap-1.5">
          <h2 id="insights-title" className={`${SECTION_TITLE} text-[clamp(1.6rem,3.4vw,2.2rem)] leading-tight`}>
            Insights
            <span aria-hidden="true" className="text-chart-child">
              .
            </span>
          </h2>
          <p className="max-w-xl text-base text-muted">How feeds, sleep and diapers add up over the last 7 or 30 days.</p>
        </header>
        <Insights key={child.id} childId={child.id} token={token} />
      </section>
    </>
  );
}
