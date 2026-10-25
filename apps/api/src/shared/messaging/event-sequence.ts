/**
 * ADR-013 Amendment A (W2 C1, decided 2026-10-25): per-aggregate ordering.
 *
 * The broker guarantees **no** ordering, so two relay instances can publish row N+1 before
 * row N of the same aggregate (or a `DEAD` row can be replayed long after newer events for
 * that aggregate have landed). Every event therefore carries a sequence number that is
 * monotonically increasing **per aggregate**, and a consumer that has already applied a
 * higher one ignores the late arrival.
 *
 * Two rules make this safe to roll out (E8: emitters first, consumer strictness last):
 *
 * - A **missing** sequence means "older than anything already known", never invalid. Rows
 *   written before this amendment are still deliverable; dropping historical events while
 *   fixing a dropped-event bug would defeat the purpose.
 * - An aggregate with **no** recorded sequence has seen nothing, so the first event always
 *   applies.
 */

/** The floor for an unstamped event: below every real sequence. */
export const UNSEQUENCED = -1;

/** How far received watermarks are kept. Older aggregates are re-read from the row. */
export const WATERMARK_RETENTION = 5000;

/**
 * The sequence carried by an envelope, or `UNSEQUENCED` when the producer predates the field
 * or the value is unusable. Never throws: an envelope is judged by `parseEnvelope`, not here.
 */
export function sequenceOf(envelope: { sequence?: unknown }): number {
  const value = envelope.sequence;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return UNSEQUENCED;
  }
  return value;
}

/**
 * The aggregate a sequence is counted within: the entity the consumers key on, which is also
 * the field they read. Null only for an event published without one, which no current
 * emitter does.
 */
export function aggregateIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  for (const key of ['bookingId', 'classId', 'accountId', 'transactionId']) {
    const value = record[key];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return null;
}

export interface Watermark {
  aggregateId: string;
  sequence: number;
}

/**
 * Whether an incoming event is newer than what this consumer has already applied for the
 * same aggregate.
 *
 * Equality applies: two events can legitimately share a sequence only if they are the same
 * event, and that is the idempotency store's job, not this one's.
 */
export function isNewerThan(seen: number | undefined, incoming: number): boolean {
  if (seen === undefined) {
    return true;
  }
  return incoming >= seen;
}

/** Adds the observed sequence to a bounded watermark map, evicting the oldest entry. */
export function remember(
  watermarks: Map<string, number>,
  aggregateId: string,
  sequence: number,
): void {
  watermarks.set(aggregateId, sequence);
  if (watermarks.size > WATERMARK_RETENTION) {
    const oldest = watermarks.keys().next();
    if (!oldest.done) {
      watermarks.delete(oldest.value);
    }
  }
}
