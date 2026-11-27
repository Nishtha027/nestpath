"use client";

import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useWakingNote, wakeApi, WAKING_NOTE } from "@/lib/server-wake";
import { API_URL, ApiError } from "@/lib/api";
import { authModeFrom, LOGIN_HREF, REGISTER_HREF, type AuthMode } from "@/lib/welcome";
import { coverThen } from "../PageCurtain";
import { Follower } from "../landing/Follower";
import { Sticker } from "../landing/Sticker";
import { Roll, Words } from "../landing/Words";
import { Icon, type IconName } from "../ui/Icon";
import { Message } from "../ui/Message";
import { TransitionLink } from "../ui/TransitionLink";

type Vars = CSSProperties & Record<`--${string}`, string>;

// The form's own fields: bigger than the app's, with a thick edge that
// turns forest green on focus (line-strong is 3:1 on the page).
const FIELD = "flex flex-col gap-2";
const LABEL = "text-xs font-bold tracking-[0.16em] text-ink uppercase";
const INPUT =
  "min-h-14 rounded-2xl border-2 border-line-strong bg-surface px-4 text-base text-ink transition-colors placeholder:text-muted hover:border-primary focus:border-primary";

// What the left panel and the headline say for each tab.
const COPY: Record<AuthMode, { eyebrow: string; title: [string, string]; button: string }> = {
  login: { eyebrow: "Log in", title: ["Back to", "the log."], button: "Log in" },
  register: { eyebrow: "Create an account", title: ["Start your", "nest."], button: "Create account" },
};

// A network failure (not an answer from the API). Locally that almost always
// means the backend isn't running, so say which address it tried.
function unreachable(): string {
  return /\/\/(localhost|127\.0\.0\.1)/.test(API_URL)
    ? `Can't reach the API at ${API_URL}. Start the backend, then try again.`
    : "Couldn't reach NestPath. Try again.";
}

export default function LoginPage() {
  const { token, sessionExpired } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Right after logging in, the page curtain is already rising and goes
    // to the dashboard itself once it covers the screen.
    if (token && !document.documentElement.dataset.curtain) router.replace("/dashboard");
  }, [token, router]);

  // Arriving here from another page: wake things again if they've dozed off
  // since (a no-op when they were seen up recently).
  useEffect(() => {
    wakeApi();
  }, []);

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[1fr_1fr]">
      <Follower />
      <BrandPanel />
      <main className="np-grain relative isolate flex flex-1 flex-col overflow-x-clip px-4 pt-8 pb-14 sm:px-10 lg:px-16 lg:pt-10">
        <div aria-hidden="true" className="np-dots absolute inset-0 -z-10" />
        <div className="flex items-center justify-between gap-4">
          <TransitionLink
            href="/"
            className="inline-flex min-h-11 items-center font-heading text-2xl font-semibold text-ink lg:invisible"
          >
            Nest<span className="text-primary-ink">Path</span>
          </TransitionLink>
          <TransitionLink
            href="/"
            className="np-cta np-roll-host inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface"
          >
            {/* Turned inside a turned box, the nudge points back home. */}
            <span className="inline-flex rotate-180">
              <span className="np-nudge inline-flex">
                <Icon name="arrowRight" className="h-4 w-4" />
              </span>
            </span>
            <Roll>Home</Roll>
          </TransitionLink>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
          {sessionExpired && <Message tone="warning">Your session expired. Log in again.</Message>}
          {/* The tab comes from ?mode= in the address, which is only known in
              the browser; the prerendered page shows the Log in tab. */}
          <Suspense fallback={<AuthForm mode="login" />}>
            <AuthFormFromUrl />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

type Moment = { icon: IconName; what: string; who: string; card: string; badge: string; tilt: string };

// The same family moments as the landing page, as stickers on the panel.
const MOMENTS: Moment[] = [
  { icon: "bottle", what: "Bottle · 120 ml", who: "Sam · just now", card: "bg-lime text-ink", badge: "bg-primary text-on-primary", tilt: "-rotate-2" },
  { icon: "moon", what: "Nap · 1 h 12 min", who: "Priya · 1 h ago", card: "bg-night-pink text-ink", badge: "bg-surface text-secondary-ink", tilt: "rotate-2 sm:ml-10" },
  { icon: "heart", what: "Dinner drop-off claimed", who: "Rose · 2 h ago", card: "bg-surface text-ink", badge: "bg-blue-soft text-primary-ink", tilt: "-rotate-1 sm:ml-4" },
];

const RIBBON = ["Feeds", "Naps", "Diapers", "Vaccines", "Growth", "Help board", "Shared live"];

/** Wide screens: the forest panel, as on the landing hero. Big type, the
 * family's moments as tilted stickers, the spinning sticker, and a lime
 * ribbon along the bottom. Decorative; the form says everything it needs. */
function BrandPanel() {
  return (
    <aside
      aria-hidden="true"
      className="np-night np-grain relative hidden min-h-[100svh] flex-col justify-between overflow-hidden bg-night pt-10 text-on-night lg:flex"
    >
      <div className="np-dots-night absolute inset-0" />
      <div className="np-blob np-blob-lime np-loop-blob -top-[30%] -right-[30%] h-[46rem] w-[46rem] opacity-25" />
      <div className="np-blob np-blob-pink np-loop-blob -bottom-[25%] -left-[25%] h-[40rem] w-[40rem] opacity-20" style={{ animationDelay: "-9s" }} />

      <div className="relative flex items-center justify-between px-12">
        <TransitionLink href="/" tabIndex={-1} className="inline-flex items-center font-heading text-2xl font-semibold">
          Nest<span className="text-night-yellow">Path</span>
        </TransitionLink>
        <span className="text-xs font-bold tracking-[0.24em] text-night-muted uppercase">Open at 3am</span>
      </div>

      <div className="relative flex flex-col gap-10 px-12">
        <p className="np-words-load font-heading text-[clamp(3.4rem,5.6vw,5.8rem)] leading-[0.92] font-semibold tracking-[-0.035em]">
          <span className="block">
            <Words text="Same page" />
          </span>
          <span className="block">
            <Words text="by the" from={2} />
          </span>
          <span className="block">
            <Words text="next feed." from={4} wordClassName="text-night-yellow" />
          </span>
        </p>

        <ul className="flex max-w-sm flex-col gap-3">
          {MOMENTS.map((m, i) => (
            <li key={m.what} className="np-reveal" style={{ animationDelay: `${700 + i * 140}ms` }}>
              <div className={i === 1 ? "np-loop-float" : "np-loop-bob"} style={{ animationDelay: `${-i * 1700}ms` }}>
                <div className={`np-soft-shadow flex items-center gap-3 rounded-2xl px-4 py-3 ${m.card} ${m.tilt}`}>
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.badge}`}>
                    <Icon name={m.icon} className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="font-bold">{m.what}</span>
                    <span className="text-sm">{m.who}</span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="absolute -top-4 right-10 xl:right-16">
          <Sticker className="h-32 w-32 xl:h-36 xl:w-36" />
        </div>
      </div>

      <div className="relative mt-12 -rotate-2 overflow-hidden border-y border-primary bg-lime py-3 font-heading text-xl font-medium text-ink">
        <div className="np-loop-marquee">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 items-center">
              {RIBBON.map((item) => (
                <li key={item} className="flex items-center gap-5 px-5 whitespace-nowrap">
                  {item}
                  <span className="text-sm">✦</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <div className="h-8" />
    </aside>
  );
}

/** A two-way switch with a lime pill that slides to the chosen side. */
// Forest with a lime pill for the main switch; a quieter paper one with a
// forest pill for the switch inside the form.
const SWITCH = {
  bold: { track: "bg-night", pill: "bg-night-yellow", on: "text-night", off: "text-on-night hover:text-night-yellow" },
  quiet: { track: "border border-line bg-neutral-bg", pill: "bg-primary", on: "text-on-primary", off: "text-ink hover:text-primary-ink" },
};

function Switch({
  label,
  options,
  second,
  onChange,
  tone = "bold",
}: {
  label: string;
  options: [string, string];
  second: boolean;
  onChange: (second: boolean) => void;
  tone?: keyof typeof SWITCH;
}) {
  const look = SWITCH[tone];
  return (
    <div role="group" aria-label={label} data-second={second ? "" : undefined} className={`np-seg rounded-full p-1 ${look.track}`}>
      <span aria-hidden="true" className={`np-seg-pill ${look.pill}`} />
      {options.map((option, i) => {
        const selected = (i === 1) === second;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(i === 1)}
            aria-pressed={selected}
            className={`min-h-12 rounded-full px-4 text-sm font-bold transition-colors ${selected ? look.on : look.off}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function AuthFormFromUrl() {
  const mode = authModeFrom(useSearchParams().get("mode"));
  return <AuthForm mode={mode} />;
}

function AuthForm({ mode }: { mode: AuthMode }) {
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
  const copy = COPY[mode];

  // Switching tabs updates the address too, so a refresh or the back
  // button keeps the same tab (Next.js syncs useSearchParams with it).
  function setMode(next: AuthMode) {
    setError(null);
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
      // A brand-new family has no baby yet: set one up first. Everyone else
      // goes Home (which also sends a family with no child to /setup).
      const next = mode === "register" && !joinFamily ? "/setup" : "/dashboard";
      coverThen(() => router.replace(next));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : unreachable());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <p className="np-reveal inline-flex items-center gap-2 text-xs font-bold tracking-[0.24em] text-primary-ink uppercase">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-chart-child" />
          {copy.eyebrow}
        </p>
        {/* key: a new tab replays the headline's rise. */}
        <h1
          key={mode}
          className="np-words-load font-heading text-[clamp(2.8rem,6vw,4.4rem)] leading-[0.95] font-semibold tracking-[-0.03em] text-ink"
          style={{ "--d": "40ms" } as Vars}
        >
          <span className="block">
            <Words text={copy.title[0]} />
          </span>
          <span className="block">
            <Words text={copy.title[1]} from={2} wordClassName="np-ink-gradient" />
          </span>
        </h1>
      </div>

      <Switch
        label="Log in or create an account"
        options={["Log in", "Register"]}
        second={mode === "register"}
        onChange={(second) => setMode(second ? "register" : "login")}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {mode === "register" && (
          <>
            <Switch
              label="Start a family or join one"
              options={["New family", "Join a family"]}
              second={joinFamily}
              onChange={setJoinFamily}
              tone="quiet"
            />
            <div className={`np-enter ${FIELD}`}>
              <label htmlFor="login-name" className={LABEL}>
                Your name
              </label>
              <input
                id="login-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={INPUT}
              />
            </div>
            {joinFamily && (
              <div className={`np-enter ${FIELD}`}>
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
                  className={`${INPUT} font-mono tracking-widest uppercase`}
                />
                <p className="text-sm text-muted">It&apos;s on the Home page of anyone in the family.</p>
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
            autoComplete="email"
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
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={INPUT}
          />
        </div>
        {error && <Message tone="error">{error}</Message>}
        <button
          type="submit"
          disabled={submitting}
          className="np-cta np-press np-roll-host mt-1 inline-flex min-h-15 items-center justify-between gap-3 rounded-full bg-primary py-2 pr-2 pl-7 text-lg font-bold text-on-primary hover:bg-primary-hover disabled:opacity-70"
        >
          <Roll>{waking ? "Waking up..." : submitting ? "Please wait..." : copy.button}</Roll>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-night-yellow text-night">
            <span className="np-nudge inline-flex">
              <Icon name="arrowRight" className="h-5 w-5" />
            </span>
          </span>
        </button>
        <p role="status" className="text-center text-sm text-muted empty:hidden">
          {waking ? WAKING_NOTE : ""}
        </p>
      </form>
    </div>
  );
}
