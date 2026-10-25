import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * ADR-013 Amendment A (W2 C2): per-row retry backoff for the outbox.
 * See `skill-verification/…/1791072000500-AddOutboxRetryBackoff.ts` for why this column
 * exists and why it is nullable. One migration per schema because each module owns its own
 * `outbox_messages` (ADR-014).
 *
 * `schedule` owns an `outbox_messages` table like every other module, so it needs this
 * column too. Without it its relay fails on every poll with "column next_attempt_at does
 * not exist", which is what the event log showed before this migration was added — the
 * failure was invisible to the suite because the affected rows were all no-ops.
 */
export class AddOutboxRetryBackoff1791072000500 implements MigrationInterface {
  name = 'AddOutboxRetryBackoff1791072000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('outbox_messages')} ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamptz`,
    );
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
