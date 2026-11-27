"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { ageLabel } from "@/lib/app-state";
import { todayISO } from "@/lib/dates";
import type { Child, GrowthMeasurement } from "@/lib/types";
import { coverThen } from "../PageCurtain";
import { Follower } from "../landing/Follower";
import { Sticker } from "../landing/Sticker";
import { Roll, Words } from "../landing/Words";
import { Chick } from "../ui/illustrations";
import { Icon } from "../ui/Icon";
import { Message } from "../ui/Message";

type Vars = CSSProperties & Record<`--${string}`, string>;
type Sex = "male" | "female";

// The same big fields as /login.
const FIELD = "flex flex-col gap-2";
const LABEL = "text-xs font-bold tracking-[0.16em] text-ink uppercase";
const INPUT =
  "min-h-14 w-full rounded-2xl border-2 border-line-strong bg-surface px-4 text-base text-ink transition-colors placeholder:text-muted hover:border-primary focus:border-primary";

// Same as Home's selection, so the new baby is the one Home opens on.
const SELECTED_KEY = "nestpath.selectedChild";

const SEXES: { value: Sex; label: string }[] = [
  { value: "female", label: "Girl" },
  { value: "male", label: "Boy" },
];

/** First stop after signing up: the baby's basics, then Home. A family that
 * already has a child (someone who joined with an invite code, or a second
 * visit) goes straight on to Home. */
export default function SetupPage() {
  const { token, logout } = useRequireAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch<Child[]>("/children", { token })
      .then((list) => {
        if (cancelled) return;
        if (list.length > 0) router.replace("/dashboard");
        else setChecked(true);
      })
      // Can't tell: show the form; creating a child still works.
      .catch(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the child is saved, so a failed measurement retries on its own.
  const [child, setChild] = useState<Child | null>(null);

  if (!token || !checked) return null;

  function goHome(saved: Child) {
    try {
      sessionStorage.setItem(SELECTED_KEY, saved.id);
    } catch {
      // Home falls back to the first child, which this is.
    }
    coverThen(() => router.replace("/dashboard"));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!sex) {
      setError("Choose Girl or Boy. It picks the right WHO growth chart.");
      return;
    }
    setSubmitting(true);
    let saved = child;
    try {
      if (!saved) {
        saved = await apiFetch<Child>("/children", {
          token,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), birth_date: birthDate, sex }),
        });
        setChild(saved);
      }
      if (weightKg || heightCm) {
        await apiFetch<GrowthMeasurement>(`/children/${saved.id}/growth`, {
          token,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            measured_at: todayISO(),
            sex,
            weight_kg: weightKg ? Number(weightKg) : null,
            length_cm: heightCm ? Number(heightCm) : null,
          }),
        });
      }
      goHome(saved);
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : "Couldn't reach NestPath. Try again.";
      setError(saved ? `${saved.name || "Your baby"} is saved, but the measurement wasn't: ${reason}` : reason);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[1fr_1fr]">
      <Follower />
      <PreviewPanel name={name} birthDate={birthDate} sex={sex} weightKg={weightKg} heightCm={heightCm} />
      <main className="np-grain relative isolate flex flex-1 flex-col overflow-x-clip px-4 pt-8 pb-14 sm:px-10 lg:px-16 lg:pt-10">
        <div aria-hidden="true" className="np-dots absolute inset-0 -z-10" />
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex min-h-11 items-center font-heading text-2xl font-semibold text-ink lg:invisible">
            Nest<span className="text-primary-ink">Path</span>
          </span>
          <button
            type="button"
            onClick={logout}
            className="np-cta np-roll-host inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface"
          >
            <Roll>Log out</Roll>
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 py-10">
          <div className="flex flex-col gap-4">
            <p className="np-reveal inline-flex items-center gap-2 text-xs font-bold tracking-[0.24em] text-primary-ink uppercase">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-chart-child" />
              Set up
            </p>
            <h1
              className="np-words-load font-heading text-[clamp(2.8rem,6vw,4.4rem)] leading-[0.95] font-semibold tracking-[-0.03em] text-ink"
              style={{ "--d": "40ms" } as Vars}
            >
              <span className="block">
                <Words text="Meet your" />
              </span>
              <span className="block">
                <Words text="little one." from={2} wordClassName="np-ink-gradient" />
              </span>
            </h1>
            <p className="text-base text-muted">
              A few basics so vaccines, growth charts and the log fit your baby. You can change them later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className={FIELD}>
              <label htmlFor="setup-name" className={LABEL}>
                Baby&apos;s name
              </label>
              <input
                id="setup-name"
                type="text"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!!child}
                required
                className={INPUT}
              />
            </div>

            <div className={FIELD}>
              <label htmlFor="setup-born" className={LABEL}>
                Born on
              </label>
              <input
                id="setup-born"
                type="date"
                value={birthDate}
                max={todayISO()}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={!!child}
                required
                className={INPUT}
              />
            </div>

            <fieldset className={FIELD} disabled={!!child}>
              <legend className={`${LABEL} mb-2`}>Gender</legend>
              <div className="grid grid-cols-2 gap-2 rounded-full border border-line bg-neutral-bg p-1">
                {SEXES.map((option) => {
                  const on = sex === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-bold transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
                        on ? "bg-primary text-on-primary" : "text-ink hover:text-primary-ink"
                      }`}
                    >
                      <input
                        type="radio"
                        name="setup-sex"
                        value={option.value}
                        checked={on}
                        onChange={() => setSex(option.value)}
                        className="sr-only"
                      />
                      {on && <Icon name="check" className="h-4 w-4" />}
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <div className={FIELD}>
                  <label htmlFor="setup-weight" className={LABEL}>
                    Weight (kg)
                  </label>
                  <input
                    id="setup-weight"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.5"
                    max="30"
                    placeholder="e.g. 4.2"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div className={FIELD}>
                  <label htmlFor="setup-height" className={LABEL}>
                    Height (cm)
                  </label>
                  <input
                    id="setup-height"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="30"
                    max="120"
                    placeholder="e.g. 54"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>
              <p className="text-sm text-muted">Optional. Saved as today&apos;s measurement on the growth chart.</p>
            </div>

            {error && <Message tone="error">{error}</Message>}

            <button
              type="submit"
              disabled={submitting}
              className="np-cta np-press np-roll-host mt-1 inline-flex min-h-15 items-center justify-between gap-3 rounded-full bg-primary py-2 pr-2 pl-7 text-lg font-bold text-on-primary hover:bg-primary-hover disabled:opacity-70"
            >
              <Roll>{submitting ? "Saving..." : "Continue to Home"}</Roll>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-night-yellow text-night">
                <span className="np-nudge inline-flex">
                  <Icon name="arrowRight" className="h-5 w-5" />
                </span>
              </span>
            </button>
            {child && (
              <button
                type="button"
                onClick={() => goHome(child)}
                className="min-h-11 text-sm font-semibold text-primary-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-primary"
              >
                Skip the measurement for now
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

/** Wide screens: the forest panel from /login, with the baby's card filling
 * in as the form is typed. Decorative; the form says everything it needs. */
function PreviewPanel({
  name,
  birthDate,
  sex,
  weightKg,
  heightCm,
}: {
  name: string;
  birthDate: string;
  sex: Sex | null;
  weightKg: string;
  heightCm: string;
}) {
  const shown = name.trim() || "Your baby";
  const age = birthDate && birthDate <= todayISO() ? ageLabel(birthDate) : "Age shows here";
  const facts = [
    sex ? (sex === "female" ? "Girl" : "Boy") : null,
    weightKg ? `${weightKg} kg` : null,
    heightCm ? `${heightCm} cm` : null,
  ].filter(Boolean);

  return (
    <aside
      aria-hidden="true"
      className="np-night np-grain relative hidden min-h-[100svh] flex-col justify-between overflow-hidden bg-night py-10 text-on-night lg:flex"
    >
      <div className="np-dots-night absolute inset-0" />
      <div className="np-blob np-blob-lime np-loop-blob -top-[30%] -right-[30%] h-[46rem] w-[46rem] opacity-25" />
      <div className="np-blob np-blob-pink np-loop-blob -bottom-[25%] -left-[25%] h-[40rem] w-[40rem] opacity-20" style={{ animationDelay: "-9s" }} />

      <div className="relative flex items-center justify-between px-12">
        <span className="inline-flex items-center font-heading text-2xl font-semibold">
          Nest<span className="text-night-yellow">Path</span>
        </span>
        <span className="text-xs font-bold tracking-[0.24em] text-night-muted uppercase">One step</span>
      </div>

      <div className="relative flex flex-col gap-10 px-12">
        <p className="np-words-load font-heading text-[clamp(3rem,5vw,5.2rem)] leading-[0.92] font-semibold tracking-[-0.035em]">
          <span className="block">
            <Words text="Every feed," />
          </span>
          <span className="block">
            <Words text="nap and jab," from={2} />
          </span>
          <span className="block">
            <Words text="in one place." from={5} wordClassName="text-night-yellow" />
          </span>
        </p>

        <div className="np-reveal max-w-sm" style={{ animationDelay: "700ms" }}>
          <div className="np-loop-bob">
            <div className="np-soft-shadow flex -rotate-2 items-center gap-4 rounded-[1.75rem] bg-lime px-5 py-5 text-ink">
              <Chick animated className="h-16 w-16 shrink-0" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-heading text-2xl font-semibold">{shown}</span>
                <span className="text-sm tabular-nums">{age}</span>
                {facts.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {facts.map((fact) => (
                      <span key={fact} className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-on-primary tabular-nums">
                        {fact}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -top-4 right-10 xl:right-16">
          <Sticker className="h-32 w-32 xl:h-36 xl:w-36" />
        </div>
      </div>
      <div />
    </aside>
  );
}
