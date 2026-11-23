import type { ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon";

/** A phone drawn in HTML, for the landing page's demos. Everything inside
 * is sized in em off a font size that scales with the phone's width
 * (container query units), so the same screen works at any size. */
export function Phone({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  /** Read out instead of the decorative screen. */
  label: string;
}) {
  return (
    <div role="img" aria-label={label} className={`@container ${className}`}>
      <div className="np-phone-shadow relative rounded-[14cqi] bg-ink p-[2.6cqi]">
        <div aria-hidden="true" className="relative aspect-[9/18.5] overflow-hidden rounded-[11.5cqi] bg-page text-[4.3cqi] leading-[1.35] text-ink">
          <div className="absolute top-[1.1em] left-1/2 z-10 h-[1.5em] w-[28%] -translate-x-1/2 rounded-full bg-ink" />
          <div className="flex items-center justify-between px-[1.6em] pt-[1.05em] text-[0.8em] font-bold tabular-nums">
            <span>9:41</span>
            <span className="flex items-center gap-[0.3em]">
              <span className="h-[0.7em] w-[1.1em] rounded-[0.2em] border-[0.12em] border-ink" />
            </span>
          </div>
          <div className="flex h-[calc(100%-2.4em)] flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

export type Tone = "pink" | "blue" | "green" | "yellow";

const BADGE: Record<Tone, string> = {
  pink: "bg-pink-soft text-secondary-ink",
  blue: "bg-blue-soft text-primary-ink",
  green: "bg-success-bg text-success-ink",
  yellow: "bg-warning-bg text-warning-ink",
};

/** A round icon badge, in the same colours the app gives each entry type. */
export function Badge({ icon, tone, className = "h-[2.1em] w-[2.1em]" }: { icon: IconName; tone: Tone; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${BADGE[tone]} ${className}`}>
      <Icon name={icon} className="h-[55%] w-[55%]" />
    </span>
  );
}

/** A caregiver's initial in a circle. */
export function Avatar({ name, tone, className = "h-[1.9em] w-[1.9em] text-[0.8em]" }: { name: string; tone: Tone; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-surface ${BADGE[tone]} ${className}`}
    >
      {name[0]}
    </span>
  );
}

const DOT = {
  success: ["text-success-ink", "bg-success-ink"],
  info: ["text-info-ink", "bg-info-ink"],
  night: ["text-night", "bg-night"],
} as const;

/** "Live" with a dot that keeps pinging. */
export function LiveDot({
  className = "h-[0.55em] w-[0.55em]",
  tone = "success",
}: {
  className?: string;
  tone?: keyof typeof DOT;
}) {
  return (
    <span className={`relative inline-flex ${DOT[tone][0]} ${className}`}>
      <span className="np-loop-ping" />
      <span className={`relative inline-flex h-full w-full rounded-full ${DOT[tone][1]}`} />
    </span>
  );
}
