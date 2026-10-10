"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useWakingNote, wakeApi, WAKING_NOTE } from "@/lib/server-wake";
import { ApiError } from "@/lib/api";
import { BUTTON_PRIMARY, FIELD, INPUT, LABEL, MUTED } from "@/lib/ui";
import { authModeFrom, LOGIN_HREF, REGISTER_HREF, type AuthMode } from "@/lib/welcome";
import { Message } from "../ui/Message";
import { Chick } from "../ui/illustrations";
import { Flower, Sprig } from "../ui/illustrations/ParentAndBaby";

/** One option of a two-way switch (Log in / Register, Start / Join). */
function segmentClass(selected: boolean) {
  return `min-h-11 flex-1 rounded-full px-4 text-sm transition-colors ${
    selected
      ? "border border-line bg-surface font-bold text-ink"
      : "border border-transparent font-semibold text-secondary-ink hover:bg-secondary-hover"
  }`;
}

/** Leaves and a flower peeking out from behind the card's corner. */
function CornerLeaves({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 130" aria-hidden="true" focusable="false" className={className}>
      <Sprig x={70} y={128} />
      <Flower x={96} y={92} r={7} petal="var(--np-art-petal-pink)" />
    </svg>
  );
}

export default function LoginPage() {
  const { token, sessionExpired } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  // Arriving here from another page: wake things again if they've dozed off
  // since (a no-op when they were seen up recently).
  useEffect(() => {
    wakeApi();
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-x-clip px-4 py-10">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-full px-3 font-heading text-2xl font-semibold text-ink"
      >
        NestPath
      </Link>

      {sessionExpired && (
        <Message tone="warning" className="w-full max-w-sm">
          Your session expired. Log in again.
        </Message>
      )}

      <div className="np-enter relative isolate w-full max-w-sm pt-[76px]">
        <CornerLeaves className="absolute -right-6 -bottom-12 -z-10 h-28 w-28 -scale-x-100 sm:-right-14 sm:-bottom-8" />
        <CornerLeaves className="absolute -bottom-10 -left-6 -z-10 h-24 w-24 sm:-left-14 sm:-bottom-6" />
        <Chick animated className="absolute top-0 left-1/2 h-24 w-24 -translate-x-1/2" />
        {/* The tab comes from ?mode= in the address, which is only known in
            the browser; the prerendered page shows the Log in tab. */}
        <Suspense fallback={<AuthCard mode="login" />}>
          <AuthCardFromUrl />
        </Suspense>
      </div>
    </main>
  );
}

function AuthCardFromUrl() {
  const mode = authModeFrom(useSearchParams().get("mode"));
  return <AuthCard mode={mode} />;
}

function AuthCard({ mode }: { mode: AuthMode }) {
  const { login, register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [joinFamily, setJoinFamily] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const waking = useWakingNote(submitting, 3000);

  // Switching tabs updates the address too, so a refresh or the back
  // button keeps the same tab (Next.js syncs useSearchParams with it).
  function setMode(next: AuthMode) {
    window.history.replaceState(null, "", next === "register" ? REGISTER_HREF : LOGIN_HREF);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password, joinFamily ? inviteCode : undefined);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach NestPath. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_40px_-28px_var(--np-ink)] sm:p-6">
      <h1 className="text-center font-heading text-2xl font-semibold text-ink">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>

      <div className="flex gap-1 rounded-full bg-pink-soft p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          aria-pressed={mode === "login"}
          className={segmentClass(mode === "login")}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          aria-pressed={mode === "register"}
          className={segmentClass(mode === "register")}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "register" && (
          <>
            <div className="flex gap-1 rounded-full bg-pink-soft p-1">
              <button
                type="button"
                onClick={() => setJoinFamily(false)}
                aria-pressed={!joinFamily}
                className={segmentClass(!joinFamily)}
              >
                New family
              </button>
              <button
                type="button"
                onClick={() => setJoinFamily(true)}
                aria-pressed={joinFamily}
                className={segmentClass(joinFamily)}
              >
                Join a family
              </button>
            </div>
            <div className={FIELD}>
              <label htmlFor="login-name" className={LABEL}>
                Your name
              </label>
              <input
                id="login-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={INPUT}
              />
            </div>
            {joinFamily && (
              <div className={FIELD}>
                <label htmlFor="login-invite" className={LABEL}>
                  Invite code
                </label>
                <input
                  id="login-invite"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${INPUT} font-mono uppercase tracking-widest`}
                />
                <p className={MUTED}>
                  It&apos;s on the Home page of anyone in the family.
                </p>
              </div>
            )}
          </>
        )}
        <div className={FIELD}>
          <label htmlFor="login-email" className={LABEL}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className={FIELD}>
          <label htmlFor="login-password" className={LABEL}>
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={INPUT}
          />
        </div>
        {error && <Message tone="error">{error}</Message>}
        <button type="submit" disabled={submitting} className={BUTTON_PRIMARY}>
          {waking ? "Waking up..." : submitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>
        <p role="status" className={`${MUTED} text-center empty:hidden`}>
          {waking ? WAKING_NOTE : ""}
        </p>
      </form>
    </div>
  );
}
