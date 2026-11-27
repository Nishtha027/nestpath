"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAppState } from "@/lib/app-state";
import { navItems } from "@/lib/nav";
import { formatDuration, minutesBetween } from "@/lib/tracker";
import type { CareLog, CareLogLatest } from "@/lib/types";
import { useVolumeUnit } from "@/lib/volume-unit";
import { parseVoiceCommand, VOICE_EXAMPLES, type VoiceIntent, type VoiceSection } from "@/lib/voice-intent";
import { Icon } from "../ui/Icon";

// The browser's speech recognition (Chrome, Edge, Safari). Not in
// TypeScript's DOM types yet, so just the parts used here.
type RecognitionResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const noSubscribe = () => () => {};

const LISTEN_ERRORS: Record<string, string> = {
  "not-allowed": "The microphone is blocked. Allow it from the icon in the address bar, or type below.",
  "service-not-allowed": "This browser won't let NestPath use speech here. You can type below.",
  "no-speech": "I didn't hear anything. Tap the mic and try again.",
  "audio-capture": "No microphone was found. You can type below.",
  network: "Speech needs an internet connection in this browser. You can type below.",
};

type Result = {
  tone: "success" | "info" | "error";
  text: string;
  /** The entry just saved, so it can be taken back. */
  undo?: { childId: string; entryId: string };
  link?: { href: string; label: string };
};

/** How many times a refused mic start is retried (about 2.4 s in all). */
const MAX_RETRIES = 3;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Says a short confirmation out loud after a spoken command, so a parent
 * holding the baby doesn't have to look at the screen. */
function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/\bml\b/g, "millilitres").replace(/\bmin\b/g, "minutes"));
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

/** The mic button on every logged-in page, and the panel it opens. Say (or
 * type) what happened: "120 ml bottle", "wet diaper", "she fell asleep",
 * "open vaccines". lib/voice-intent.ts works out what that means; this
 * saves it with the same API calls the Log page makes, offers Undo, and
 * reads the result back. */
export function VoiceAssistant() {
  const { caregiver } = useAuth();
  const { token, selectedChild } = useAppState();
  const [unit] = useVolumeUnit();
  const router = useRouter();
  const canListen = useSyncExternalStore(noSubscribe, () => recognitionClass() !== null, () => false);

  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [working, setWorking] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const recognition = useRef<Recognition | null>(null);
  /** Bumped for every listening session; events from older ones are ignored. */
  const session = useRef(0);
  const watchdog = useRef<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Stop listening and talking when the panel closes or the page goes.
  useEffect(() => {
    if (open) return;
    session.current++;
    window.clearTimeout(watchdog.current);
    recognition.current?.abort();
    recognition.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [open]);
  useEffect(
    () => () => {
      session.current++;
      window.clearTimeout(watchdog.current);
      recognition.current?.abort();
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function hrefFor(section: VoiceSection): string {
    // Insights are on the Log page, under the form.
    if (section === "insights") return selectedChild ? `/children/${selectedChild.id}/log#insights` : "/dashboard";
    return navItems(selectedChild?.id ?? null, Boolean(caregiver?.isProvider)).find((item) => item.key === section)?.href ?? "/dashboard";
  }

  async function run(text: string, spoken: boolean) {
    setHeard(text);
    setResult(null);
    const finish = (next: Result) => {
      setResult(next);
      setWorking(false);
      if (spoken) speak(next.text);
    };
    const now = new Date();
    const intent: VoiceIntent = parseVoiceCommand(text, now, unit);

    if (intent.kind === "unknown") {
      finish({ tone: "info", text: "I couldn't match that to something to log or open. Try one of the examples below." });
      return;
    }
    if (intent.kind === "invalid") return finish({ tone: "error", text: intent.message });
    if (intent.kind === "navigate") {
      router.push(hrefFor(intent.section));
      return finish({ tone: "success", text: `${intent.summary}.` });
    }

    const child = selectedChild;
    if (!child) {
      router.push("/dashboard");
      return finish({ tone: "info", text: "Add your baby on Home first, then I can log for them." });
    }
    const name = child.name || "your baby";
    const history = { href: `/children/${child.id}/history`, label: "See it in History" };
    if (intent.kind === "open-form") {
      router.push(`/children/${child.id}/log?type=${intent.type}`);
      return finish({ tone: "info", text: `${intent.summary}.` });
    }

    setWorking(true);
    const post = (body: Record<string, unknown>) =>
      apiFetch<CareLog>(`/children/${child.id}/care-logs`, {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    try {
      if (intent.kind === "log") {
        const entry = await post(intent.payload);
        return finish({ tone: "success", text: `Saved for ${name}: ${intent.summary}.`, undo: { childId: child.id, entryId: entry.id }, link: history });
      }
      const latest = await apiFetch<CareLogLatest>(`/children/${child.id}/care-logs/latest`, { token });
      const running = latest.sleep?.in_progress ? latest.sleep : null;
      if (intent.kind === "sleep-start") {
        if (running) return finish({ tone: "info", text: `A sleep timer is already running, since ${clock(running.occurred_at)}.` });
        const body: Record<string, unknown> = { type: "sleep", in_progress: true };
        if (intent.startedAt) body.occurred_at = intent.startedAt;
        const entry = await post(body);
        return finish({
          tone: "success",
          text: `Sleep timer started for ${name}${intent.startedAt ? `, from ${clock(intent.startedAt)}` : ""}. Say "she woke up" to stop it.`,
          undo: { childId: child.id, entryId: entry.id },
          link: { href: `/children/${child.id}/log?type=sleep`, label: "See the timer" },
        });
      }
      // sleep-stop
      if (!running) return finish({ tone: "info", text: "No sleep timer is running right now." });
      // A stop must land after the start, even with phone and server clocks apart.
      const end = new Date(Math.max(intent.endedAt ? Date.parse(intent.endedAt) : now.getTime(), Date.parse(running.occurred_at) + 60_000));
      await apiFetch<CareLog>(`/children/${child.id}/care-logs/${running.id}`, {
        token,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ended_at: end.toISOString() }),
      });
      return finish({ tone: "success", text: `Sleep timer stopped. ${name} slept ${formatDuration(minutesBetween(running.occurred_at, end))}.`, link: history });
    } catch (err) {
      finish({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't reach NestPath. Try again." });
    }
  }

  async function undo(target: NonNullable<Result["undo"]>) {
    setWorking(true);
    try {
      await apiFetch<void>(`/children/${target.childId}/care-logs/${target.entryId}`, { token, method: "DELETE" });
      setResult({ tone: "info", text: "Undone. That entry is removed." });
    } catch (err) {
      setResult({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't undo. Try again from History." });
    } finally {
      setWorking(false);
    }
  }

  /** Listens for one sentence. Safe to call again and again: each call is
   * its own session (a late event from an earlier one is ignored), the mic
   * only starts once the spoken answer has stopped (otherwise the browser
   * often refuses it or ends it at once), a refused start is retried once,
   * and a session that never reports back is reset by a watchdog. Every
   * way it can end tells the parent what happened. */
  function listen(attempt = 0) {
    const Speech = recognitionClass();
    if (!Speech) {
      input.current?.focus();
      return;
    }
    const id = ++session.current;
    const current = () => id === session.current;
    const previous = recognition.current;
    recognition.current = null;
    previous?.abort();
    window.clearTimeout(watchdog.current);
    const wasSpeaking = "speechSynthesis" in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    setHeard("");
    setResult(null);
    setListening(true);

    let finalText = "";
    let error = "";
    let gotAudio = false;
    const fail = (text: string) => {
      if (!current()) return;
      session.current++; // ends this session: its late events are ignored
      window.clearTimeout(watchdog.current);
      recognition.current = null;
      setListening(false);
      setResult({ tone: "error", text });
    };

    const begin = () => {
      if (!current()) return;
      const rec = new Speech();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event) => {
        if (!current()) return;
        gotAudio = true;
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i];
          if (piece.isFinal) finalText += piece[0].transcript;
          else interim += piece[0].transcript;
        }
        setHeard(`${finalText} ${interim}`.trim());
      };
      rec.onerror = (event) => {
        error = event.error;
      };
      rec.onend = () => {
        if (!current()) return;
        window.clearTimeout(watchdog.current);
        recognition.current = null;
        const text = finalText.trim();
        if (!text && error === "aborted" && !gotAudio && attempt < MAX_RETRIES) {
          // Ended before it began (the mic wasn't free yet): stay on
          // "Listening" and try again, waiting a little longer each time.
          window.setTimeout(() => current() && listen(attempt + 1), 400 * (attempt + 1));
          return;
        }
        setListening(false);
        if (text) {
          void run(text, true);
        } else if (error && error !== "aborted") {
          setResult({ tone: "error", text: LISTEN_ERRORS[error] ?? "Speech stopped. Tap the mic and try again." });
        } else {
          setResult({ tone: "info", text: "I didn't catch anything. Tap the mic and try again." });
        }
      };
      recognition.current = rec;
      try {
        rec.start();
      } catch {
        // The browser still holds the mic from the last session: wait, retry once.
        recognition.current = null;
        if (attempt < MAX_RETRIES) window.setTimeout(() => current() && listen(attempt + 1), 400 * (attempt + 1));
        else fail("The microphone is busy. Wait a moment and tap it again.");
        return;
      }
      // If the browser never reports back, don't stay stuck on "Listening".
      watchdog.current = window.setTimeout(() => {
        if (!current() || !recognition.current) return;
        const stuck = recognition.current;
        fail("Listening timed out. Tap the mic and try again.");
        stuck.abort();
      }, 15_000);
    };

    // Let a spoken answer stop, and the last session let go of the mic.
    window.setTimeout(begin, wasSpeaking || previous ? 250 : 0);
  }

  function stopListening() {
    const rec = recognition.current;
    if (rec) rec.stop();
    else {
      // Nothing to stop (it already ended): just reset.
      session.current++;
      window.clearTimeout(watchdog.current);
      setListening(false);
    }
  }

  function onMic() {
    if (!open) {
      setOpen(true);
      if (canListen) listen();
      else requestAnimationFrame(() => input.current?.focus());
      return;
    }
    if (listening) stopListening();
    else if (canListen) listen();
    else input.current?.focus();
  }

  function onType(e: FormEvent) {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    void run(text, false);
  }

  const title = listening ? "Listening..." : working ? "On it..." : result ? "Anything else?" : "Tell NestPath what happened";

  return (
    <div className="print:hidden">
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="voice-title"
          className="np-voice-panel np-night np-card fixed inset-x-3 bottom-[calc(10.75rem+env(safe-area-inset-bottom))] z-40 flex max-h-[70svh] flex-col gap-4 overflow-y-auto rounded-[1.75rem] bg-night p-5 text-on-night sm:left-auto sm:w-[26rem] md:right-6 md:bottom-28"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold tracking-[0.2em] text-night-muted uppercase">Voice</p>
              <h2 id="voice-title" className="font-heading text-xl leading-tight font-semibold">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="np-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-night-line text-on-night hover:border-night-yellow hover:text-night-yellow"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {canListen && (
              <button
                type="button"
                onClick={() => (listening ? stopListening() : listen())}
                disabled={working}
                aria-label={listening ? "Stop listening" : "Tap to speak"}
                className={`np-press relative inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full disabled:opacity-60 ${
                  listening ? "bg-night-yellow text-night" : "border-2 border-night-yellow text-night-yellow hover:bg-night-yellow hover:text-night"
                }`}
              >
                {listening && <span aria-hidden="true" className="np-loop-listen" />}
                <Icon name={listening ? "stop" : "mic"} className="relative h-7 w-7" />
              </button>
            )}
            <p className={`min-h-[2.5em] min-w-0 font-heading text-2xl leading-snug font-semibold ${heard ? "text-night-yellow" : "text-night-muted"}`}>
              {heard ? `“${heard}”` : listening ? "Go ahead, I'm listening." : canListen ? "Tap the mic and say “120 ml bottle at 3 pm”" : "Type what happened, like “wet diaper”"}
            </p>
          </div>

          <div role="status" aria-live="polite" className="empty:hidden">
            {result && (
              <div
                className={`flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm ${
                  result.tone === "success" ? "bg-night-yellow text-night" : result.tone === "error" ? "bg-danger-bg text-danger-ink" : "bg-night-raised text-on-night"
                }`}
              >
                <p className="flex items-start gap-2 font-semibold">
                  <Icon name={result.tone === "success" ? "checkCircle" : result.tone === "error" ? "alertCircle" : "info"} className="mt-0.5 h-[18px] w-[18px]" />
                  {result.text}
                </p>
                {(result.undo || result.link) && (
                  <div className="flex flex-wrap gap-2">
                    {result.undo && (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => undo(result.undo!)}
                        className="np-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-night px-4 font-bold text-on-night disabled:opacity-60"
                      >
                        <Icon name="retry" className="h-4 w-4" />
                        Undo
                      </button>
                    )}
                    {result.link && (
                      <Link
                        href={result.link.href}
                        onClick={() => setOpen(false)}
                        className="inline-flex min-h-11 items-center rounded-full border border-current px-4 font-bold"
                      >
                        {result.link.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-night-muted">Or tap one</p>
            <ul className="flex flex-wrap gap-2">
              {VOICE_EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    disabled={working || listening}
                    onClick={() => run(example, false)}
                    className="np-press inline-flex min-h-11 items-center rounded-full border border-night-line px-3.5 text-sm font-semibold text-on-night hover:border-night-yellow hover:text-night-yellow disabled:opacity-60"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={onType} className="flex gap-2">
            <label htmlFor="voice-text" className="sr-only">
              Type a command
            </label>
            <input
              ref={input}
              id="voice-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type it instead"
              autoComplete="off"
              className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-night-line bg-night-raised px-4 text-base text-on-night placeholder:text-night-muted hover:border-night-yellow focus:border-night-yellow"
            />
            <button
              type="submit"
              disabled={working || !typed.trim()}
              aria-label="Do it"
              className="np-press inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-night-yellow text-night disabled:opacity-60"
            >
              <Icon name="arrowRight" className="h-5 w-5" />
            </button>
          </form>

          <p className="text-xs text-night-muted">
            {canListen
              ? "Your browser turns speech into text. Nothing is saved until NestPath understands it, and every entry can be undone."
              : "This browser can't listen, but typing works the same way."}
          </p>
        </section>
      )}

      <button
        ref={button}
        type="button"
        onClick={onMic}
        aria-expanded={open}
        aria-label={listening ? "Stop listening" : open ? "Speak again" : "Voice assistant: say what happened"}
        className={`np-press np-card fixed right-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-40 inline-flex h-16 w-16 items-center justify-center rounded-full md:right-6 md:bottom-6 ${
          listening ? "bg-night-yellow text-night" : "bg-primary text-on-primary hover:bg-primary-hover"
        }`}
      >
        {listening && <span aria-hidden="true" className="np-loop-listen" />}
        <Icon name={listening ? "stop" : "mic"} className="relative h-7 w-7" />
      </button>
    </div>
  );
}
