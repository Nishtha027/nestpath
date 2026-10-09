// Retrying page loads. The free-tier backend and database sleep when idle,
// so the first request after a quiet spell can fail while they wake up.
// Retry only what a retry can fix: network errors and 5xx. A 4xx (bad
// request, not found, 401 expired session) would fail the same way again.

export const LOAD_RETRY_DELAYS_MS = [1000, 3000];

export const WAKING_UP_MESSAGE = "Couldn't load this. The server may be waking up.";

export function isRetryable(err: unknown): boolean {
  // fetch() rejects with a TypeError when no response arrived at all.
  if (err instanceof TypeError) return true;
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 500;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `load`, retrying once per entry in `delaysMs` (after that delay)
 * while the failure is retryable. Only for reads -- never wrap a POST. */
export async function withRetry<T>(
  load: () => Promise<T>,
  { delaysMs = LOAD_RETRY_DELAYS_MS, wait = sleep }: { delaysMs?: number[]; wait?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (err) {
      if (attempt >= delaysMs.length || !isRetryable(err)) throw err;
      await wait(delaysMs[attempt]);
    }
  }
}

/** What to show when a load finally fails: the friendly waking-up message
 * for retryable failures, otherwise the server's own message. */
export function loadErrorMessage(err: unknown, fallback: string): string {
  if (isRetryable(err)) return WAKING_UP_MESSAGE;
  return err instanceof Error && err.message ? err.message : fallback;
}
