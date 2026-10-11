import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-004 / ADR-029: widen the account role set to include `verifier`. Verifier (and
 * Administrator) accounts are operator-provisioned; public registration still only
 * creates learner/teacher (enforced in the contract + use case).
 */
export class WidenAccountRoles1791072000004 implements MigrationInterface {
  name = 'WidenAccountRoles1791072000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} DROP CONSTRAINT IF EXISTS "accounts_role_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} ADD CONSTRAINT "accounts_role_check"
         CHECK ("role" IN ('learner', 'teacher', 'verifier', 'admin'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} DROP CONSTRAINT IF EXISTS "accounts_role_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('accounts')} ADD CONSTRAINT "accounts_role_check"
         CHECK ("role" IN ('learner', 'teacher', 'admin'))`,
    );
  }
}
