"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import type { ScreeningHistoryItem, ScreeningSubmitResponse } from "@/lib/types";
import { EPDS_ITEMS } from "@/lib/epds-items";
import {
  BAND_TEXT,
  needHelpText,
  nextCheckIn,
  resultSections,
  type ResultSection,
} from "@/lib/wellbeing";
import { CrisisSupport, SupportLines } from "./SupportLines";
import { Toolkit } from "./Toolkit";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const PRIMARY = `rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black ${FOCUS}`;
const SECONDARY = `rounded border border-black/25 px-4 py-2 hover:bg-black/[.05] dark:border-white/30 dark:hover:bg-white/[.08] ${FOCUS}`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Shown before the questionnaire. Matches what the backend actually does:
 * GET /screenings/me is own-results-only, and GET /alerts shows every
 * flagged (risk_level "high") result to every provider account. */
function AboutNote() {
  return (
    <div className="flex flex-col gap-2 rounded border border-black/15 bg-black/[.02] px-4 py-3 text-sm dark:border-white/20 dark:bg-white/[.04]">
      <p>
        <strong>This is a screening, not a diagnosis.</strong> The 10 questions (the Edinburgh
        Postnatal Depression Scale) can suggest whether talking to someone might help. They
        can&apos;t tell you what&apos;s going on -- only a conversation with a provider can.
      </p>
      <p>
        <strong>Who can see your results:</strong> your results are saved to your account, and
        other caregivers in your family can&apos;t see them. A result is <em>flagged</em> if the
        total is 13 or more, or if you answer anything other than &ldquo;Never&rdquo; to the
        question about harming yourself. Flagged results appear in an Alerts list that{" "}
        <strong>every provider account in NestPath can see, across all families</strong>. That
        list shows the score, the date, whether that question was flagged, and account and family
        ID numbers -- not your name, email or individual answers. A flagged result does not mean
        anyone will contact you, so please reach out yourself if you need support.
      </p>
    </div>
  );
}

function NeedHelp({ result, onBack }: { result: ScreeningSubmitResponse; onBack: () => void }) {
  const { selectedChild } = useAppState();
  const text = needHelpText(result);
  const bandLabel = BAND_TEXT[result.score_band].label;
  return (
    <section aria-labelledby="need-help-heading" className="flex flex-col gap-3">
      <h2 id="need-help-heading" className="text-lg font-medium">
        Do you need help?
      </h2>
      <div className="flex flex-col gap-2 rounded border border-black/15 px-4 py-3 dark:border-white/20">
        <p className="text-base font-medium">{text.headline}</p>
        <p className="text-sm">{text.detail}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your score: {result.total_score} of 30 ({bandLabel}). This is a screening result, not a
          diagnosis.
        </p>
        {text.suggestAppointment && (
          <div className="flex flex-col gap-1">
            <Link
              href={selectedChild ? `/children/${selectedChild.id}/appointments` : "/dashboard"}
              className={`self-start ${PRIMARY}`}
            >
              Go to Appointments
            </Link>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Your own doctor, midwife or OB is also a good person to call.
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onBack} className={SECONDARY}>
          Back to Wellbeing
        </button>
      </div>
    </section>
  );
}

export default function WellbeingPage() {
  const { token } = useAppState();

  const [view, setView] = useState<"home" | "questions" | "result">("home");
  const [history, setHistory] = useState<ScreeningHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningSubmitResponse | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    apiFetch<ScreeningHistoryItem[]>("/screenings/me", { token })
      .then(setHistory)
      .catch((err) =>
        setHistoryError(err instanceof ApiError ? err.message : "Failed to load your check-ins")
      )
      .finally(() => setHistoryLoading(false));
  }, [token]);

  // Move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (view === "result") resultHeading.current?.focus();
  }, [view]);

  const allAnswered = EPDS_ITEMS.every((item) => answers[item.number] !== undefined);

  function startCheckIn() {
    setAnswers({});
    setError(null);
    setResult(null);
    setView("questions");
    window.scrollTo({ top: 0 });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allAnswered) return;
    setError(null);
    setSubmitting(true);
    try {
      const orderedAnswers = EPDS_ITEMS.map((item) => answers[item.number]);
      const res = await apiFetch<ScreeningSubmitResponse>("/screenings", {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: orderedAnswers }),
      });
      setResult(res);
      setHistory((prev) => [
        {
          id: res.id,
          total_score: res.total_score,
          score_band: res.score_band,
          item_10_flag: res.item_10_flag,
          created_at: res.created_at,
        },
        ...prev,
      ]);
      setView("result");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit check-in");
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "result" && result) {
    const sections: Record<ResultSection, React.ReactNode> = {
      crisis: <CrisisSupport key="crisis" />,
      needHelp: <NeedHelp key="needHelp" result={result} onBack={() => setView("home")} />,
      toolkit: <Toolkit key="toolkit" band={result.score_band} />,
      supportLines: <SupportLines key="supportLines" />,
    };
    return (
      <>
        <h1 ref={resultHeading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
          Your check-in result
        </h1>
        {/* Order comes from the server's item_10_flag: crisis support first when set. */}
        {resultSections(result).map((section) => sections[section])}
      </>
    );
  }

  if (view === "questions") {
    return (
      <>
        <h1 className="text-xl font-semibold">Postpartum check-in (EPDS)</h1>
        <AboutNote />
        <p className="text-sm">
          Answer based on how you have felt over the <strong>past 7 days</strong>, not just today.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {EPDS_ITEMS.map((item) => (
            <fieldset key={item.number} className="flex flex-col gap-2">
              <legend className="text-sm font-medium">
                {item.number}. {item.text}
              </legend>
              <div className="flex flex-col gap-1">
                {item.options.map((option, index) => (
                  <label key={index} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`item-${item.number}`}
                      value={index}
                      checked={answers[item.number] === index}
                      onChange={() => setAnswers((prev) => ({ ...prev, [item.number]: index }))}
                      required
                      className={FOCUS}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={submitting || !allAnswered} className={PRIMARY}>
              {submitting ? "Submitting..." : "See my result"}
            </button>
            <button type="button" onClick={() => setView("home")} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </form>
      </>
    );
  }

  const latest = history[0];
  const checkIn = latest ? nextCheckIn(latest.created_at) : null;

  return (
    <>
      <h1 className="text-xl font-semibold">Wellbeing</h1>

      <section aria-labelledby="checkin-heading" className="flex flex-col gap-3">
        <h2 id="checkin-heading" className="text-lg font-medium">
          Postpartum check-in
        </h2>
        {historyLoading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
        ) : historyError ? (
          <p className="text-sm text-red-700 dark:text-red-400">{historyError}</p>
        ) : !latest || !checkIn ? (
          <p className="text-sm">
            A short, private 10-question check-in on how you&apos;ve been feeling over the past
            week. It takes about 5 minutes.
          </p>
        ) : checkIn.isDue ? (
          <p className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
            It&apos;s been two weeks since your last check-in ({formatDate(latest.created_at)}) --
            a good time to check in again.
          </p>
        ) : (
          <p className="text-sm">
            Last check-in: {formatDate(latest.created_at)}. Check in again in 2 weeks, around{" "}
            <strong>{formatDate(checkIn.due.toISOString())}</strong> -- or any time sooner if you
            want to.
          </p>
        )}
        <AboutNote />
        <button type="button" onClick={startCheckIn} className={`self-start ${PRIMARY}`}>
          {latest ? "Retake check-in" : "Start check-in"}
        </button>
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <h2 id="history-heading" className="text-lg font-medium">
            Your past check-ins
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Only you can see this list.</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/15 dark:border-white/20">
                <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                <th scope="col" className="py-2 pr-4 font-medium">Score</th>
                <th scope="col" className="py-2 font-medium">Band</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b border-black/10 dark:border-white/10">
                  <td className="py-2 pr-4">{formatDate(row.created_at)}</td>
                  <td className="py-2 pr-4">{row.total_score} / 30</td>
                  <td className="py-2">{BAND_TEXT[row.score_band].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <SupportLines />
    </>
  );
}
