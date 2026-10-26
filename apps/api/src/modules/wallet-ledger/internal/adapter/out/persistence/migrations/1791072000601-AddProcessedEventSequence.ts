import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * ADR-013 Amendment A (W2 C1): the consumer-side half of ordering.
 *
 * `processed_events` already answers "have I seen this event id". The same table now also
 * holds the highest sequence applied per (consumer queue, aggregate), under a separate DONE
 * row whose id is `<queue>:seq:<aggregateId>` — that is, one row per watermark, with
 * `sequence` describing the id.
 *
 * It lives here rather than in a new table because idempotency and ordering are the same
 * question asked twice ("did I already apply this state?"), and because this table is
 * already per consumer, in the consumer's own schema.
 *
 * `sequence` is nullable: pre-existing rows are delivery records and carry no watermark.
 */
export class AddProcessedEventSequence1791072000601 implements MigrationInterface {
  name = 'AddProcessedEventSequence1791072000601';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('processed_events')} ADD COLUMN IF NOT EXISTS "sequence" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('processed_events')} DROP COLUMN IF EXISTS "sequence"`,
    );
  }
}
