import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-001 / ADR-030: collapse the account role set to `user | verifier | admin`.
 * `learner` and `teacher` are capabilities, not roles (BR-063), so existing rows are
 * rewritten to `user` (hard cut; no transitional acceptance of the old values), then
 * the CHECK constraint is tightened.
 */
export class CollapseAccountRoles1791072000005 implements MigrationInterface {
  name = 'CollapseAccountRoles1791072000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} DROP CONSTRAINT IF EXISTS "accounts_role_check"`,
    );
    await queryRunner.query(
      `UPDATE ${table('accounts')} SET "role" = 'user', "updated_at" = now()
         WHERE "role" IN ('learner', 'teacher')`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} ADD CONSTRAINT "accounts_role_check"
         CHECK ("role" IN ('user', 'verifier', 'admin'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} DROP CONSTRAINT IF EXISTS "accounts_role_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} ADD CONSTRAINT "accounts_role_check"
         CHECK ("role" IN ('learner', 'teacher', 'verifier', 'admin'))`,
    );
  }
}
