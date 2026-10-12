"use client";

import { useId, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import { SECTION_TITLE } from "@/lib/ui";
import { Icon } from "./Icon";

export type SheetHandle = { open: () => void; close: () => void };

/** A panel over the page: slides up from the bottom on phones, sits in the
 * middle on wider screens. A native modal <dialog>, so focus stays inside
 * it, Escape closes it and focus returns to the button that opened it.
 * Tapping the dimmed backdrop closes it too. On opening, focus goes to the
 * sheet itself (screen readers read its title), not to the Close button;
 * Tab moves on to Close and then the sheet's contents. */
export function Sheet({
  ref,
  title,
  children,
  onClose,
}: {
  ref: Ref<SheetHandle>;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        const el = dialog.current;
        if (!el || el.open) return;
        el.showModal();
        el.focus();
      },
      close: () => dialog.current?.close(),
    }),
    []
  );

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="np-sheet np-dialog mx-auto outline-none mt-auto mb-0 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-0 text-ink sm:mb-auto sm:rounded-3xl"
    >
      <div className="flex flex-col gap-4 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className={SECTION_TITLE}>
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="np-press inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-page hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
