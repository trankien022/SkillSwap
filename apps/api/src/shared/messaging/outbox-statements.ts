import { OUTBOX_TABLE } from './constants';
import { qualified } from '../sql/ident';

export interface OutboxRow {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: Date;
}

/** Inserts the event body only — id, status and timestamps are owned by the outbox. */
export function insertOutboxStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return `INSERT INTO ${table} (event_type, payload) VALUES ($1, $2::jsonb) RETURNING id`;
}

export function claimPendingStatement(schema: string): string {
  const table = qualified(schema, OUTBOX_TABLE);
  return (
    `SELECT id, event_type, payload, created_at FROM ${table} ` +
    `WHERE status = 'PENDING' ORDER BY created_at, id LIMIT $1 FOR UPDATE SKIP LOCKED`
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
