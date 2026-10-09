"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { BUTTON_PRIMARY, CARD, FIELD, INPUT, LABEL, MUTED } from "@/lib/ui";
import { BrandMark } from "../ui/BrandMark";
import { Message } from "../ui/Message";

/** One option of a two-way switch (Log in / Register, Start / Join). */
function segmentClass(selected: boolean) {
  return `min-h-11 flex-1 rounded-full px-4 text-sm transition-colors ${
    selected
      ? "border border-line bg-surface font-bold text-ink"
      : "border border-transparent font-semibold text-secondary-ink hover:bg-secondary-hover"
  }`;
}

export default function LoginPage() {
  const { token, login, register, sessionExpired } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [joinFamily, setJoinFamily] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

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
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="inline-flex items-center gap-2 text-3xl font-bold tracking-tight">
          <BrandMark />
          NestPath
        </h1>
        <p className={MUTED}>A companion app for new parents</p>
      </div>

      {sessionExpired && (
        <Message tone="warning" className="w-full max-w-sm">
          Your session expired. Please log in again.
        </Message>
      )}

      <div className={`${CARD} w-full max-w-sm`}>
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
                  Start a new family
                </button>
                <button
                  type="button"
                  onClick={() => setJoinFamily(true)}
                  aria-pressed={joinFamily}
                  className={segmentClass(joinFamily)}
                >
                  Join an existing family
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
                    Ask a caregiver already in the family -- the code is on their dashboard.
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
            {submitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
