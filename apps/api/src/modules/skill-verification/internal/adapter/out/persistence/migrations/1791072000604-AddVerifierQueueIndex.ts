import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-004 / NFR-014: supporting index for the Verifier's keyset-paged queue.
 *
 * The queue filters on `status = 'pending'` and pages/orders by `(submitted_at, id)`
 * in both directions, and runs a `COUNT(*)` over the same filter. `(status,
 * submitted_at, id)` lets Postgres serve both the page and the count from the index,
 * with the `id` tiebreaker the shared keyset helper requires for a stable cursor.
 */
export class AddVerifierQueueIndex1791072000604 implements MigrationInterface {
  name = 'AddVerifierQueueIndex1791072000604';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_skill_evidence_queue" ON ${table('skill_evidence')} ("status", "submitted_at", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ${table('skill_evidence')}."ix_skill_evidence_queue"`);
  }
}
