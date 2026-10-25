/**
 * ADR-013 Amendment A (W2 C2, decided 2026-10-25): how long to wait after a retryable publish
 * failure.
 *
 * ## Why a schedule at all
 *
 * Before this rule, a retryable failure left the row `PENDING` and the next tick — two seconds
 * later — claimed it again. A broker that is up but resetting every connection would be retried
 * at full poll rate forever, producing log noise and never backing off enough to recover.
 *
 * ## The rule
 *
 * Exponential from the poll interval, capped:
 *
 * | attempt | delay with a 2s poll | delay with a 10s poll |
 * |---------|----------------------|-----------------------|
 * | 1       | 2 s                  | 10 s                  |
 * | 2       | 4 s                  | 20 s                  |
 * | 3       | 8 s                  | 40 s                  |
 * | 4       | 16 s                 | 80 s                  |
 * | 5+      | 60 s (cap)           | 60 s (cap)            |
 *
 * Derived from the poll interval rather than a fixed constant so a deployment that polls
 * slowly does not get a backoff shorter than its own tick, and so tests can exercise the
 * progression without waiting in real time.
 *
 * The cap is deliberately small: a settlement event waiting a minute is acceptable, while an
 * hour would make a recovered broker look like data loss to whoever is watching the queue.
 *
 * ## Why the cap is not `maxDeliveryAttempts`
 *
 * Attempts are only counted for **terminal** failures now (C2). A retryable failure never
 * reaches `DEAD` through this path, so the delay must eventually reach a steady state rather
 * than run out of attempts. `MAX_DELIVERY_ATTEMPTS` continues to govern the terminal path.
 */

export const MAX_RETRY_DELAY_MS = 60_000;

/**
 * The delay before the next publish attempt.
 *
 * `failedAttempts` is how many times this row has already been retried (1 for the first
 * failure), not the stored `attempts` column — a retryable failure does not increment it.
 */
export function retryDelayMs(
  failedAttempts: number,
  pollIntervalMs: number,
  maxDelayMs: number = MAX_RETRY_DELAY_MS,
): number {
  const base = Math.max(1, pollIntervalMs);
  const exponent = Math.max(0, Math.min(failedAttempts - 1, 20));
  const delay = base * 2 ** exponent;
  return Math.min(delay, Math.max(maxDelayMs, base));
}

/** When the next attempt is due, given the moment the failure was observed. */
export function nextAttemptAt(
  now: Date,
  failedAttempts: number,
  pollIntervalMs: number,
  maxDelayMs?: number,
): Date {
  return new Date(now.getTime() + retryDelayMs(failedAttempts, pollIntervalMs, maxDelayMs));
}
