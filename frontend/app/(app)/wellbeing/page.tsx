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
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, MUTED, PAGE_TITLE, SECTION_TITLE } from "@/lib/ui";
import { Message } from "../../ui/Message";
import { Disclosure } from "../../ui/Disclosure";
import { Chick } from "../../ui/illustrations";

const PRIMARY = BUTTON_PRIMARY;
const SECONDARY = BUTTON_SECONDARY;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Shown before the questions. Matches what the backend actually does:
 * GET /screenings/me is own-results-only, and GET /alerts shows every
 * flagged (risk_level "high") result to every provider account. The
 * essentials stay visible; the full detail is one click away. */
function AboutNote() {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-pink-soft px-4 pt-3.5 pb-1.5 text-sm text-ink">
      <p>
        <strong>A screening, not a diagnosis.</strong> Your family can&apos;t see your results.
        Providers can see flagged scores, without your name; that doesn&apos;t mean anyone will
        contact you.
      </p>
      <Disclosure label="Who can see my results">
        <p>
          The 10 questions are the Edinburgh Postnatal Depression Scale (EPDS). They can suggest
          whether talking to someone might help. Only a conversation with a provider can tell you
          what&apos;s going on.
        </p>
        <p>
          Your results are saved to your account. Other caregivers in your family can&apos;t see
          them.
        </p>
        <p>
          A result is <em>flagged</em> if the total is 13 or more, or if you answer anything other
          than &ldquo;Never&rdquo; to the question about harming yourself. Flagged results appear in
          an Alerts list that{" "}
          <strong>every provider account in NestPath can see, across all families</strong>. It
          shows the score, the date, whether that question was flagged, and account and family ID
          numbers, not your name, email or answers.
        </p>
        <p>
          A flagged result doesn&apos;t mean anyone will contact you, so please reach out yourself
          if you need support.
        </p>
      </Disclosure>
    </div>
  );
}

function NeedHelp({ result, onBack }: { result: ScreeningSubmitResponse; onBack: () => void }) {
  const { selectedChild } = useAppState();
  const text = needHelpText(result);
  const bandLabel = BAND_TEXT[result.score_band].label;
  return (
    <section aria-labelledby="need-help-heading" className={CARD}>
      <h2 id="need-help-heading" className={SECTION_TITLE}>
        {text.headline}
      </h2>
      <div className="flex flex-col gap-2">
        <p>{text.detail}</p>
        <p className={`${MUTED} tabular-nums`}>
          Score {result.total_score} / 30, {bandLabel}. A screening, not a diagnosis.
        </p>
        {text.suggestAppointment && (
          <div className="flex flex-col gap-1">
            <Link
              href={selectedChild ? `/children/${selectedChild.id}/appointments` : "/dashboard"}
              className={`self-start ${PRIMARY}`}
            >
              Go to Appointments
            </Link>
            <p className={MUTED}>Or call your own doctor, midwife or OB.</p>
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
        setHistoryError(err instanceof ApiError ? err.message : "Couldn't load your check-ins. Refresh to try again.")
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
      setError(err instanceof ApiError ? err.message : "Couldn't submit. Your answers are still here; try again.");
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
        <h1 ref={resultHeading} tabIndex={-1} className={`${PAGE_TITLE} focus:outline-none`}>
          Your result
        </h1>
        {/* Order comes from the server's item_10_flag: crisis support first when set. */}
        {resultSections(result).map((section) => sections[section])}
      </>
    );
  }

  if (view === "questions") {
    return (
      <>
        <h1 className={PAGE_TITLE}>Postpartum check-in</h1>
        <AboutNote />
        <p>
          Answer for the <strong>past 7 days</strong>, not just today.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {EPDS_ITEMS.map((item) => (
            <fieldset key={item.number} className={CARD}>
              <legend className="float-left mb-1 w-full font-semibold">
                {item.number}. {item.text}
              </legend>
              <div className="flex flex-col gap-2">
                {item.options.map((option, index) => (
                  <label
                    key={index}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm hover:bg-page has-checked:border-primary-ink has-checked:bg-blue-soft has-checked:font-semibold"
                  >
                    <input
                      type="radio"
                      name={`item-${item.number}`}
                      value={index}
                      checked={answers[item.number] === index}
                      onChange={() => setAnswers((prev) => ({ ...prev, [item.number]: index }))}
                      required
                      className="h-5 w-5 shrink-0 accent-primary"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {error && <Message tone="error">{error}</Message>}

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
      {/* The only illustration on this page: small, still, and only here,
          never near the questions, results or crisis support. */}
      <div className="flex items-center justify-between gap-4">
        <h1 className={PAGE_TITLE}>Wellbeing</h1>
        <Chick resting className="h-14 w-14 shrink-0" />
      </div>

      <section aria-labelledby="checkin-heading" className={`${CARD} tabular-nums`}>
        <h2 id="checkin-heading" className={SECTION_TITLE}>
          Postpartum check-in
        </h2>
        {historyLoading ? (
          <p className={MUTED}>Loading...</p>
        ) : historyError ? (
          <Message tone="error">{historyError}</Message>
        ) : !latest || !checkIn ? (
          <p>10 questions about the past week. About 5 minutes.</p>
        ) : checkIn.isDue ? (
          <Message tone="info">
            Last check-in {formatDate(latest.created_at)}. Time for another.
          </Message>
        ) : (
          <p>
            Last check-in {formatDate(latest.created_at)}. Next around{" "}
            <strong>{formatDate(checkIn.due.toISOString())}</strong>, or sooner if you like.
          </p>
        )}
        <button type="button" onClick={startCheckIn} className={`self-start ${PRIMARY}`}>
          {latest ? "Retake check-in" : "Start check-in"}
        </button>
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history-heading" className={CARD}>
          <h2 id="history-heading" className={SECTION_TITLE}>
            Past check-ins
          </h2>
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-semibold">Date</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Score</th>
                <th scope="col" className="py-2 font-semibold">Band</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-t border-line">
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
