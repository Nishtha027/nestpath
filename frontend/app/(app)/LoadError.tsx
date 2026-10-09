"use client";

/** A failed load, with a button to try it again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
      <p className="text-red-700 dark:text-red-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-black/25 px-3 py-1 hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-white/30 dark:hover:bg-white/[.06]"
      >
        Retry
      </button>
    </div>
  );
}
