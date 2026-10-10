// Waking the API. The free-tier server sleeps after a quiet spell and takes
// up to about a minute to start again. Every page load pings /health straight
// away (see AuthProvider), so the server is already starting while someone
// reads the page or types their password, and every request waits for that
// ping (see apiFetch) instead of failing part-way through a cold start.

/** How long to keep trying before giving up (a cold start is ~45 seconds). */
export const WAKE_BUDGET_MS = 90_000;
/** Pause between pings after one fails. */
export const WAKE_RETRY_MS = 3_000;
/** After a successful ping the server counts as awake for this long; it
 * only goes back to sleep after about 15 idle minutes. */
export const AWAKE_FOR_MS = 5 * 60_000;

type WakerOptions = {
  /** Resolves true when the server answered healthy. */
  ping: () => Promise<boolean>;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  budgetMs?: number;
  retryMs?: number;
  awakeForMs?: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createWaker({
  ping,
  now = Date.now,
  wait = sleep,
  budgetMs = WAKE_BUDGET_MS,
  retryMs = WAKE_RETRY_MS,
  awakeForMs = AWAKE_FOR_MS,
}: WakerOptions) {
  let awakeAt = -Infinity;
  let pending: Promise<boolean> | null = null;

  const isAwake = () => now() - awakeAt < awakeForMs;

  async function run(): Promise<boolean> {
    const deadline = now() + budgetMs;
    for (;;) {
      try {
        if (await ping()) {
          awakeAt = now();
          return true;
        }
      } catch {
        // No answer yet; try again below.
      }
      if (now() + retryMs >= deadline) return false;
      await wait(retryMs);
    }
  }

  /** Resolves true once the server is up (immediately if it was seen up
   * recently), or false if it didn't answer in time. Calls made while a
   * ping is in flight share it. */
  function wake(): Promise<boolean> {
    if (isAwake()) return Promise.resolve(true);
    pending ??= run().finally(() => {
      pending = null;
    });
    return pending;
  }

  /** Any answer from the server shows it's up. */
  function markAwake() {
    awakeAt = now();
  }

  return { wake, isAwake, markAwake };
}
