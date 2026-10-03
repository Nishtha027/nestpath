"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import type { ScreeningSubmitResponse } from "@/lib/types";
import { EPDS_ITEMS } from "@/lib/epds-items";

export default function ScreeningPage() {
  const { token, caregiver, logout } = useRequireAuth();

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningSubmitResponse | null>(null);

  const allAnswered = EPDS_ITEMS.every((item) => answers[item.number] !== undefined);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !allAnswered) return;
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit screening");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8 font-sans">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">Postpartum check-in (EPDS)</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>{caregiver?.email}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded bg-black/[.06] px-3 py-1 dark:bg-white/[.08]"
          >
            Log out
          </button>
        </div>
      </header>

      <p className="text-sm text-zinc-500">
        This is a screening tool, not a diagnosis. Answer based on how you have felt over the
        past 7 days, not just today.
      </p>

      {result ? (
        <section className="flex flex-col gap-3">
          <div
            className={`rounded border px-4 py-3 text-sm ${
              result.item_10_flag
                ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                : "bg-black/[.03] dark:bg-white/[.05]"
            }`}
          >
            {result.item_10_flag && <p className="mb-1 font-semibold">Please read this</p>}
            <p>{result.message}</p>
          </div>
          <p className="text-xs text-zinc-500">
            Score: {result.total_score} &middot; Risk level: {result.risk_level}
          </p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            Back to dashboard
          </Link>
        </section>
      ) : (
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
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !allAnswered}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      )}
    </main>
  );
}
