export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30_000;

/** Delay before reconnect attempt number `attempt` (0 = the first retry
 * after a drop): 1s, 2s, 4s, 8s, 16s, then 30s from there on. */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
}
