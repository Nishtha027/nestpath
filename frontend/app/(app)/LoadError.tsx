"use client";

import { BUTTON_SECONDARY } from "@/lib/ui";
import { Icon } from "../ui/Icon";
import { Message } from "../ui/Message";

/** A failed load, with a button to try it again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2">
      <Message tone="error">{message}</Message>
      <button type="button" onClick={onRetry} className={`self-start ${BUTTON_SECONDARY}`}>
        <Icon name="retry" className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}
