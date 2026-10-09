import type { ReactNode } from "react";
import { MUTED } from "@/lib/ui";

/** "Nothing here yet", with a small decorative character. The art box has a
 * fixed size, so nothing shifts when it renders. */
export function EmptyState({ art, title, children }: { art: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3 text-center">
      <div className="mb-1 h-20 w-20 shrink-0">{art}</div>
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className={`${MUTED} max-w-sm`}>{children}</p>}
    </div>
  );
}
