import { OUTBOX_TABLE } from './constants';
import { qualified } from '../sql/ident';

export interface OutboxRow {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: Date;
  /** Attempts already burned by terminal failures; absent on rows claimed before the column. */
  attempts?: number;
  /** ADR-013 Amendment A (W2 C1): position within the aggregate; null on legacy rows. */
  sequence?: number | null;
}

/**
 * Inserts the event body only — id, status, timestamps and the aggregate sequence are owned
 * by the outbox.
 *
 * ADR-013 Amendment A (W2 C1): the sequence is computed **inside this statement**, from the
 * rows already in this table for the same aggregate. Doing it here rather than in the caller
 * is what makes it correct — the caller's transaction is the one that also writes the
 * aggregate's state change, so the number cannot be handed out to an event whose change is
 * later rolled back, and the `COALESCE(MAX(...), -1) + 1` is evaluated under the table lock of
 * the enclosing transaction. The aggregate id is lifted from the payload by key, which is the
 * same key the consumers read.
 */
export function insertOutboxStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return (
    `INSERT INTO ${table} (event_type, payload, aggregate_id, sequence) ` +
    `SELECT $1, $2::jsonb, agg.value, COALESCE(MAX(o.sequence), -1) + 1 ` +
    `FROM (SELECT COALESCE($2::jsonb->>'bookingId', $2::jsonb->>'classId', ` +
    `$2::jsonb->>'accountId', $2::jsonb->>'transactionId') AS value) agg ` +
    `LEFT JOIN ${table} o ON o.aggregate_id = agg.value ` +
    `GROUP BY agg.value RETURNING id, sequence`
  );
}

export function claimPendingStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return (
    `SELECT id, event_type, payload, created_at, attempts, sequence FROM ${table} ` +
    // ADR-013 Amendment A (W2 C2): a row backing off from a retryable failure is not due yet.
    // `NULL` means "due now", which is every row written before the column existed.
    `WHERE status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= now()) ` +
    `ORDER BY created_at, id LIMIT $1 FOR UPDATE SKIP LOCKED`
  );
}

export function markPublishedStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return (
    `UPDATE ${table} SET status = 'PUBLISHED', published_at = now() ` +
    `WHERE id = ANY($1::uuid[])`
  );
}

export function recordAttemptStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return (
    `UPDATE ${table} SET attempts = attempts + 1, last_error = $2, ` +
    `status = CASE WHEN attempts + 1 >= $3 THEN 'DEAD'::text ELSE status END ` +
    `WHERE id = $1`
  );
}

/**
 * ADR-013 Amendment A (W2 C2, decided 2026-10-25): a retryable publish failure.
 *
 * Records the error and when the row may be tried again. Deliberately **not** an attempt
 * against `MAX_DELIVERY_ATTEMPTS`: `attempts` now counts terminal failures only, so a
 * transient socket reset can never exhaust the budget that guards the dead-letter path.
 */
export function scheduleRetryStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return `UPDATE ${table} SET last_error = $2, next_attempt_at = $3::timestamptz WHERE id = $1`;
}

/** ADR-013 Amendment A (W2 C3): the replay reset — a dead row goes back to being due now. */
export function replayDeadLetterStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return (
    `UPDATE ${table} SET status = 'PENDING', attempts = 0, last_error = NULL, ` +
    `next_attempt_at = NULL WHERE id = $1 AND status = 'DEAD' RETURNING status`
  );
}
