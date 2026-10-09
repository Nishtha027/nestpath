// Shared Tailwind class strings, so buttons, fields and cards look the same
// everywhere. Colors come only from the design tokens in app/globals.css.
// Focus rings come from the global :focus-visible rule there, and the
// np-* motion classes (press, enter, lift) are defined there too.

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold " +
  "np-press disabled:cursor-not-allowed disabled:opacity-60";

/** The main action: deeper blue with white text. */
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-on-primary hover:bg-primary-hover`;

/** Secondary actions: soft pink tint with deep pink text. */
export const BUTTON_SECONDARY = `${BUTTON_BASE} bg-secondary-bg text-secondary-ink hover:bg-secondary-hover`;

/** Form fields: a strong enough edge (3:1) to see where to type. */
export const INPUT =
  "min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-base text-ink tabular-nums placeholder:text-muted";

export const LABEL = "text-sm font-semibold text-ink";
export const FIELD = "flex flex-col gap-1.5";

/** A section of a page. Hairline border; fades in, lifts a little on hover. */
export const CARD = "np-enter np-lift flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6";

/** One row in a list inside a page or card. */
export const LIST_ITEM = "rounded-xl border border-line bg-surface px-4 py-3";

export const PAGE_TITLE = "font-heading text-2xl font-semibold text-ink";
export const SECTION_TITLE = "font-heading text-lg font-semibold text-ink";
export const SUBSECTION_TITLE = "font-heading text-base font-medium text-ink";
export const MUTED = "text-sm text-muted";
export const LINK = "font-semibold text-primary-ink underline underline-offset-2";
