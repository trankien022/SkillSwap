import { OUTBOX_TABLE } from './constants';
import { qualified } from '../sql/ident';

export interface OutboxRow {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: Date;
  /** Attempts already burned by terminal failures; absent on rows claimed before the column. */
  attempts?: number;
}

/** Inserts the event body only — id, status and timestamps are owned by the outbox. */
export function insertOutboxStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return `INSERT INTO ${table} (event_type, payload) VALUES ($1, $2::jsonb) RETURNING id`;
}

export function claimPendingStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return (
    `SELECT id, event_type, payload, created_at, attempts FROM ${table} ` +
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
