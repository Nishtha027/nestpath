"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 font-sans">
      <h1 className="text-2xl font-semibold">NestPath</h1>

      {sessionExpired && (
        <p className="max-w-sm text-center text-sm text-amber-700 dark:text-amber-400">
          Your session expired. Please log in again.
        </p>
      )}

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded px-3 py-1 ${mode === "login" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.06] dark:bg-white/[.08]"}`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded px-3 py-1 ${mode === "register" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.06] dark:bg-white/[.08]"}`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        {mode === "register" && (
          <>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setJoinFamily(false)}
                className={`rounded px-3 py-1 ${!joinFamily ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.06] dark:bg-white/[.08]"}`}
              >
                Start a new family
              </button>
              <button
                type="button"
                onClick={() => setJoinFamily(true)}
                className={`rounded px-3 py-1 ${joinFamily ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.06] dark:bg-white/[.08]"}`}
              >
                Join an existing family
              </button>
            </div>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded border px-3 py-2"
            />
            {joinFamily && (
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="rounded border px-3 py-2 font-mono uppercase"
                />
                <p className="text-xs text-zinc-500">
                  Ask a caregiver already in the family -- the code is on their dashboard.
                </p>
              </div>
            )}
          </>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </main>
  );
}
