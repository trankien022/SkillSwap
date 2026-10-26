import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * ADR-013 Amendment A (W2 C2, decided 2026-10-25): per-row retry backoff for the outbox.
 *
 * Without this column a retryable publish failure was retried on the very next poll tick, so a
 * broker that was up but repeatedly resetting was hammered at full rate and never got room to
 * recover. `next_attempt_at` lets the claim statement skip rows that are not yet due.
 *
 * Nullable rather than `DEFAULT now()`: an existing row must remain immediately claimable, so
 * `NULL` means "due now" and the claim predicate is `next_attempt_at IS NULL OR
 * next_attempt_at <= now()`.
 *
 * Owned by the shared messaging layer but created here, because each module owns its own
 * schema and therefore its own copy of `outbox_messages` (ADR-014).
 */
export class AddOutboxRetryBackoff1791072000500 implements MigrationInterface {
  name = 'AddOutboxRetryBackoff1791072000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('outbox_messages')} ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamptz`,
    );
    // The claim reads PENDING rows in created_at order; this index lets it skip not-yet-due
    // rows without scanning the whole backlog after a long outage.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_outbox_messages_due" ON ${table('outbox_messages')} ("status", "next_attempt_at", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ${table('outbox_messages')}."ix_outbox_messages_due"`);
    await queryRunner.query(
      `ALTER TABLE ${table('outbox_messages')} DROP COLUMN IF EXISTS "next_attempt_at"`,
    );
  }
}
