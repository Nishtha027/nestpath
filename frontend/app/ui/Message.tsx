import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type Tone = "error" | "success" | "warning" | "info";

// Each tone has its own icon shape as well as its color, so the meaning
// never depends on color alone.
const TONES: Record<Tone, { icon: IconName; className: string }> = {
  error: { icon: "alertCircle", className: "bg-danger-bg text-danger-ink" },
  success: { icon: "checkCircle", className: "bg-success-bg text-success-ink" },
  warning: { icon: "alertTriangle", className: "bg-warning-bg text-warning-ink" },
  info: { icon: "info", className: "bg-info-bg text-info-ink" },
};

/** An inline status message: error, success, warning or info. */
export function Message({
  tone,
  children,
  className = "",
  ...rest
}: { tone: Tone; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const { icon, className: toneClass } = TONES[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ${toneClass} ${className}`} {...rest}>
      <Icon name={icon} className="mt-0.5 h-[18px] w-[18px]" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
