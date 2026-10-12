"use client";

import { useState } from "react";
import Link from "next/link";
import { ageLabel, useAppState, useCurrentChild } from "@/lib/app-state";
import { averagesNote, parseDayKey, shareText, summaryChips } from "@/lib/tracker";
import { useCareLogSummary } from "@/lib/use-summary";
import { useVolumeUnit } from "@/lib/volume-unit";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, LINK, MUTED, PAGE_TITLE, SUBSECTION_TITLE } from "@/lib/ui";
import { Icon } from "../../../../ui/Icon";
import { Loading } from "../../../../ui/Loading";
import { Message } from "../../../../ui/Message";
import { Disclosure } from "../../../../ui/Disclosure";
import { LoadError } from "../../../LoadError";
import { DailyTable } from "../insights/Insights";

/** "Share with pediatrician": the last 7 days' totals and averages on one
 * plain page, to print or to copy as text into a message or a patient
 * portal. Nothing is sent anywhere by the app. */
export default function SharePage() {
  const { token } = useAppState();
  const child = useCurrentChild();
  const { summary, error, retry } = useCareLogSummary(child.id, token, 7);
  const [unit] = useVolumeUnit();
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  const name = child.name || "Your baby";
  const age = ageLabel(child.birth_date);
  const text = summary ? shareText(name, age, summary, unit) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  const range = summary
    ? `${parseDayKey(summary.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} to ${parseDayKey(
        summary.end
      ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : "";

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className={PAGE_TITLE}>Summary for your pediatrician</h1>
        <p className="text-ink tabular-nums">
          {name}, {age}
          {range && ` · ${range}`}
        </p>
      </div>

      {error ? (
        <LoadError message={error} onRetry={retry} />
      ) : !summary ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={copy} className={BUTTON_PRIMARY}>
              <Icon name="copy" className="h-4 w-4" />
              Copy as text
            </button>
            <button type="button" onClick={() => window.print()} className={BUTTON_SECONDARY}>
              <Icon name="print" className="h-4 w-4" />
              Print
            </button>
          </div>
          <div role="status" aria-live="polite" className="print:hidden">
            {copied === "yes" && <Message tone="success">Copied. Paste it into a message or your clinic&apos;s portal.</Message>}
            {copied === "failed" && (
              <Message tone="warning">Couldn&apos;t copy here. Open &quot;Show as text&quot; below and copy it from there.</Message>
            )}
          </div>

          <section className={`${CARD} print:border-0 print:p-0`}>
            <h2 className={SUBSECTION_TITLE}>Daily averages</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              {summaryChips(summary, unit).map((chip) => (
                <li key={chip.label} className="flex flex-col">
                  <span className="text-muted">{chip.label}</span>
                  <span className="font-bold text-ink tabular-nums">{chip.value}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{averagesNote(summary)}</p>
          </section>

          <section className={`${CARD} print:border-0 print:p-0`}>
            <h2 className={SUBSECTION_TITLE}>Day by day</h2>
            <DailyTable summary={summary} unit={unit} />
          </section>

          <Disclosure label="Show as text" className="print:hidden">
            <textarea
              readOnly
              value={text}
              rows={14}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-line-strong bg-surface p-3 font-mono text-xs text-ink"
            />
          </Disclosure>

          <p className={MUTED}>Logged by the family in NestPath. Not medical advice.</p>
          <Link href={`/children/${child.id}/appointments`} className={`${LINK} self-start print:hidden`}>
            Back to appointments
          </Link>
        </>
      )}
    </section>
  );
}
