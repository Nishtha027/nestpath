import type { CSSProperties, ReactNode } from "react";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Text split into words, each rising out of its own mask (np-word in
 * globals.css). Inside a [data-reveal] block they rise as it scrolls into
 * view; inside .np-words-load they rise as the page loads. `from` offsets
 * the stagger, so several lines can run as one sequence. */
export function Words({
  text,
  from = 0,
  delayMs,
  wordClassName = "",
}: {
  text: string;
  from?: number;
  delayMs?: number;
  wordClassName?: string;
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => {
        const style: Vars = { "--i": from + i };
        if (delayMs !== undefined) style["--d"] = `${delayMs}ms`;
        return (
          <span key={i}>
            <span className="np-word-mask">
              <span className={`np-word ${wordClassName}`} style={style}>
                {word}
              </span>
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        );
      })}
    </>
  );
}

/** A small label above a section title: a dot and a few words. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold tracking-[0.14em] text-primary-ink uppercase ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-chart-child" />
      {children}
    </p>
  );
}

/** Link or button text that rolls up to a second copy on hover (np-roll in
 * globals.css). The host element needs the np-roll-host class. */
export function Roll({ children }: { children: string }) {
  return (
    <span className="np-roll">
      <span className="np-roll-inner" data-text={children}>
        {children}
      </span>
    </span>
  );
}

/** Delay for a revealed block (read by np-in-view as --d). */
export function revealDelay(ms: number): Vars {
  return { "--d": `${ms}ms` };
}
