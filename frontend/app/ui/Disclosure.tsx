import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Detail that most people don't need every time: sources, methods, longer
 * caveats. Closed by default; a native <details>, so it opens with Enter or
 * Space and needs no script. */
export function Disclosure({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group text-sm ${className}`}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <Icon name="info" className="h-4 w-4" />
        {label}
        <Icon name="chevronDown" className="h-4 w-4 group-open:rotate-180" />
      </summary>
      <div className="flex max-w-prose flex-col gap-2 pb-2 text-ink">{children}</div>
    </details>
  );
}
