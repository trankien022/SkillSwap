import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * ADR-013 Amendment A (W2 C1): per-aggregate sequence numbers on the outbox.
 *
 * Every event gets a sequence that is monotonically increasing within its aggregate, so a
 * consumer can tell a late arrival from a fresh one when the broker delivers out of order.
 * `aggregate_id` is stored rather than parsed at read time because the number is allocated
 * with a `MAX(...) + 1` over the aggregate, which needs something to group by.
 *
 * Both columns are nullable: rows written before this migration keep working and are
 * published without a sequence, which every consumer reads as "unstamped, therefore old"
 * (E8 — emitters first, consumer strictness last).
 *
 * One migration per schema because each module owns its own `outbox_messages` (ADR-014).
 */
export class AddOutboxSequence1791072000600 implements MigrationInterface {
  name = 'AddOutboxSequence1791072000600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('outbox_messages')} ADD COLUMN IF NOT EXISTS "aggregate_id" text`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('outbox_messages')} ADD COLUMN IF NOT EXISTS "sequence" integer`,
    );
    // The allocator groups by aggregate and the consumers only ever ask "the newest", so one
    // index serves both.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_outbox_messages_aggregate" ON ${table('outbox_messages')} ("aggregate_id", "sequence")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS ${table('outbox_messages')}."ix_outbox_messages_aggregate"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('outbox_messages')} DROP COLUMN IF EXISTS "sequence"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('outbox_messages')} DROP COLUMN IF EXISTS "aggregate_id"`,
    );
  }
}
