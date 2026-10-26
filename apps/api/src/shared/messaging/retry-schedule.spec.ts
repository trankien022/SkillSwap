import { MAX_RETRY_DELAY_MS, nextAttemptAt, retryDelayMs } from './retry-schedule';

/**
 * ADR-013 Amendment A (W2 C2, decided 2026-10-25): the retry backoff.
 *
 * These specs pin the shape of the schedule rather than one magic number, because the delay is
 * derived from the poll interval: a deployment that polls every 10 seconds must not back off
 * faster than it ticks, and the ceiling must stay short enough that a recovered broker looks
 * recovered to whoever is watching the queue.
 */
describe('retry schedule (ADR-013 Amendment A)', () => {
  it('doubles from the poll interval', () => {
    const poll = 2000;
    expect([1, 2, 3, 4].map((n) => retryDelayMs(n, poll))).toEqual([2000, 4000, 8000, 16000]);
  });

  it('never backs off shorter than one poll interval', () => {
    // A very slow poll must not produce a sub-tick delay, which would be meaningless.
    expect(retryDelayMs(1, 30_000)).toBe(30_000);
  });

  it('caps the delay so a recovery is visible within a minute', () => {
    expect(retryDelayMs(20, 2000)).toBe(MAX_RETRY_DELAY_MS);
  });

  it('does not let an absurd poll interval push the cap below the tick', () => {
    // The cap is a ceiling, not a floor: a 90s poll still yields 90s, not 60s.
    expect(retryDelayMs(20, 90_000)).toBe(90_000);
  });

  it('treats a zero or negative poll interval as the minimum rather than dividing by it', () => {
    expect(retryDelayMs(1, 0)).toBe(1);
    expect(retryDelayMs(2, 0)).toBe(2);
  });

  it('does not overflow on a very long failure streak', () => {
    const delay = retryDelayMs(10_000, 2000);
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBe(MAX_RETRY_DELAY_MS);
  });

  it('computes the due time from the failure moment', () => {
    const now = new Date('2026-10-25T00:00:00.000Z');
    expect(nextAttemptAt(now, 1, 2000).toISOString()).toBe('2026-10-25T00:00:02.000Z');
    expect(nextAttemptAt(now, 3, 2000).toISOString()).toBe('2026-10-25T00:00:08.000Z');
  });
});
