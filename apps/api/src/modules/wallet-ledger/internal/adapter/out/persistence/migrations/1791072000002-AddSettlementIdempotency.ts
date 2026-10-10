import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-009 (ADR-018): idempotency keys for settlement. One learner_debit and one
 * teacher_pending per booking; releases keyed so a retry under a different key
 * cannot double-release (AC-015).
 */
export class AddSettlementIdempotency1791072000002 implements MigrationInterface {
  name = 'AddSettlementIdempotency1791072000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} ADD COLUMN IF NOT EXISTS "release_key" text`,
    );
    // At most one learner_debit, one teacher_pending, one platform_fee per booking.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ledger_settlement_per_booking"
         ON ${table('ledger_entries')} ("entry_type", "reference_id")
       WHERE "entry_type" IN ('learner_debit', 'teacher_pending', 'platform_fee', 'teacher_credit')`,
    );
    // A release may only apply once per (booking, release_key).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_ledger_release_key"
         ON ${table('ledger_entries')} ("entry_type", "reference_id", "release_key")
       WHERE "entry_type" = 'release' AND "release_key" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ${table('uq_ledger_release_key')}`);
    await queryRunner.query(`DROP INDEX IF EXISTS ${table('uq_ledger_settlement_per_booking')}`);
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} DROP COLUMN IF EXISTS "release_key"`,
    );
  }
}
