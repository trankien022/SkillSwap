import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-015 / OQ-015 / ADR-037: an account lock is an extension of the `suspended` status that
 * already existed, not a new state. These three columns record *why* and *who*, so an
 * Administrator's suspension can be reviewed and ended by someone else.
 *
 * The check constraint is the part worth having in the database rather than only in the domain:
 * `suspended_reason` must be non-empty exactly when the status is `suspended`. A row that is
 * suspended with no reason is the case ADR-037 decision 2 refuses, and enforcing it here means no
 * future code path can create one by forgetting to call the domain.
 */
export class AddAccountSuspension1791072000009 implements MigrationInterface {
  name = 'AddAccountSuspension1791072000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${table('accounts')}
      ADD COLUMN IF NOT EXISTS "suspended_reason" text,
      ADD COLUMN IF NOT EXISTS "suspended_by" uuid,
      ADD COLUMN IF NOT EXISTS "suspended_at" timestamptz`);

    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} ADD CONSTRAINT "accounts_suspension_check" CHECK (
         ("status" = 'suspended' AND "suspended_reason" IS NOT NULL AND btrim("suspended_reason") <> '')
         OR ("status" <> 'suspended' AND "suspended_reason" IS NULL)
       )`,
    );

    // The lock list is read by status, filtered to suspended accounts (ADR-037 phase 3).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_accounts_status_suspended_at"
         ON ${table('accounts')} ("suspended_at" DESC) WHERE "status" = 'suspended'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS ${table('accounts')}."ix_accounts_status_suspended_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} DROP CONSTRAINT IF EXISTS "accounts_suspension_check"`,
    );
    await queryRunner.query(`ALTER TABLE ${table('accounts')}
      DROP COLUMN IF EXISTS "suspended_at",
      DROP COLUMN IF EXISTS "suspended_by",
      DROP COLUMN IF EXISTS "suspended_reason"`);
  }
}
