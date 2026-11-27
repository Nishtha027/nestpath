// Shared Tailwind class strings, so buttons, fields and cards look the same
// everywhere. Colors come only from the design tokens in app/globals.css.
// Focus rings come from the global :focus-visible rule there, and the
// np-* motion classes (press, enter, lift) are defined there too.
//
// The look follows the landing page ("Forest & Lime"): pill buttons, big
// rounded cards with a soft shadow, thick-edged fields that turn forest
// green under the pointer, and Fredoka titles set large and tight.

const BUTTON_BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold " +
  "np-press disabled:cursor-not-allowed disabled:opacity-60";

/** The main action: forest green with lime text. */
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-on-primary hover:bg-primary-hover`;

/** Secondary actions: a forest outline that fills with pale lime on hover. */
export const BUTTON_SECONDARY = `${BUTTON_BASE} border-2 border-primary bg-transparent text-primary-ink hover:bg-blue-soft`;

/** Form fields: a thick edge (3:1) that turns forest green on hover and focus. */
export const INPUT =
  "min-h-12 rounded-2xl border-2 border-line-strong bg-surface px-4 text-base text-ink tabular-nums transition-colors " +
  "placeholder:text-muted hover:border-primary focus:border-primary";

export const LABEL = "text-sm font-bold text-ink";
export const FIELD = "flex flex-col gap-2";

/** A section of a page. Big radius, soft shadow; fades in, lifts on hover. */
export const CARD =
  "np-enter np-lift np-card flex flex-col gap-4 rounded-[1.75rem] border border-line bg-surface p-5 sm:p-7";

/** One row in a list inside a page or card. */
export const LIST_ITEM = "rounded-2xl border border-line bg-surface px-4 py-3";

export const PAGE_TITLE = "font-heading text-[clamp(2rem,4.4vw,2.9rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-ink";
export const SECTION_TITLE = "font-heading text-xl font-semibold tracking-[-0.01em] text-ink";
export const SUBSECTION_TITLE = "font-heading text-base font-medium text-ink";
export const MUTED = "text-sm text-muted";
export const LINK = "font-semibold text-primary-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-primary";
