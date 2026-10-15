import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-015 / ADR-034: the supporting index for the Administrator's verification queue.
 *
 * The existing `ix_student_verifications_account_status ("account_id", "status")` cannot serve
 * this read: the admin queue is not account-scoped, and it orders by `created_at` (the
 * submission time the wire exposes), so a status filter has no leading column to use and the
 * planner would fall back to a sequential scan plus sort. This index puts the filtered status
 * first and follows it with the `(sort key, id)` pair the keyset and the tiebreaker need, so
 * both the page and its `COUNT(*)` are index-served.
 *
 * `id` is included as the final key because the keyset comparison is
 * `(created_at, id) > (cursor_time, cursor_id)` — a unique tiebreaker is what keeps paging from
 * skipping or repeating rows when several submissions share a timestamp.
 */
export class AddAdminVerificationQueueIndex1791072000104 implements MigrationInterface {
  name = 'AddAdminVerificationQueueIndex1791072000104';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_student_verifications_queue"
         ON ${table('student_verifications')} ("status", "created_at", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ${table('ix_student_verifications_queue')}`);
  }
}
