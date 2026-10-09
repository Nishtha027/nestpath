"use client";

import { BUTTON_SECONDARY } from "@/lib/ui";
import { Icon } from "../ui/Icon";
import { Message } from "../ui/Message";
import { Chick } from "../ui/illustrations";

/** A failed load, with a button to try it again. Usually this is the
 * free-tier server waking up, so the chick hops patiently beside it.
 * withArt={false} leaves the chick out, for a second error on the same page. */
export function LoadError({
  message,
  onRetry,
  withArt = true,
}: {
  message: string;
  onRetry: () => void;
  withArt?: boolean;
}) {
  return (
    <div role="alert" className="flex items-start gap-3">
      {withArt && (
        <div className="np-loop-hop h-14 w-14 shrink-0">
          <Chick className="h-14 w-14" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Message tone="error">{message}</Message>
        <button type="button" onClick={onRetry} className={`self-start ${BUTTON_SECONDARY}`}>
          <Icon name="retry" className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
