import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-015 / OQ-015 / ADR-037: require `suspended_at` alongside the reason.
 *
 * `AddAccountSuspension1791072000009` tied `suspended_reason` to the `suspended` status, which
 * catches the case the ADR cares most about — a suspension nobody can explain. It missed the
 * neighbouring one: a suspended row with a reason but **no timestamp**. The lock list orders and
 * paginates by `suspended_at DESC`, so such a row would sort unpredictably and could not be
 * paged past reliably.
 *
 * This is a second migration rather than an edit of the first because the first has already been
 * applied and recorded; changing its body would leave every database that ran it with the weaker
 * constraint while the file claimed otherwise.
 */
export class RequireSuspendedAt1791072000010 implements MigrationInterface {
  name = 'RequireSuspendedAt1791072000010';

  private readonly strict = `ALTER TABLE ${table('accounts')} ADD CONSTRAINT "accounts_suspension_check" CHECK (
      ("status" = 'suspended'
         AND "suspended_reason" IS NOT NULL AND btrim("suspended_reason") <> ''
         AND "suspended_at" IS NOT NULL)
      OR ("status" <> 'suspended' AND "suspended_reason" IS NULL AND "suspended_at" IS NULL)
    )`;

  private readonly loose = `ALTER TABLE ${table('accounts')} ADD CONSTRAINT "accounts_suspension_check" CHECK (
      ("status" = 'suspended' AND "suspended_reason" IS NOT NULL AND btrim("suspended_reason") <> '')
      OR ("status" <> 'suspended' AND "suspended_reason" IS NULL)
    )`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A suspended row without a timestamp predates this constraint and cannot be back-filled from
    // anything we hold. Refuse rather than invent a date: an audit trail with a fabricated
    // timestamp is worse than a migration that stops and asks.
    const orphans = (await queryRunner.query(
      `SELECT COUNT(*)::int AS total FROM ${table('accounts')}
        WHERE "status" = 'suspended' AND "suspended_at" IS NULL`,
    )) as { total: number }[];
    if ((orphans[0]?.total ?? 0) > 0) {
      throw new Error(
        'Cannot require suspended_at: suspended accounts without a timestamp exist. ' +
          'Set suspended_at from a known source before migrating (ADR-037).',
      );
    }

    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} DROP CONSTRAINT IF EXISTS "accounts_suspension_check"`,
    );
    await queryRunner.query(this.strict);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} DROP CONSTRAINT IF EXISTS "accounts_suspension_check"`,
    );
    await queryRunner.query(this.loose);
  }
}
