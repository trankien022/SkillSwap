import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-019 (ADR-025): the projection must also carry the `revoked` status so the
 * owner's account view reflects a revocation cascade.
 */
export class WidenAccountVerificationStatus1791072000003 implements MigrationInterface {
  name = 'WidenAccountVerificationStatus1791072000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('account_verification_status')}
         DROP CONSTRAINT IF EXISTS "account_verification_status_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('account_verification_status')}
         ADD CONSTRAINT "account_verification_status_status_check"
         CHECK ("status" IN ('pending', 'approved', 'rejected', 'revoked'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('account_verification_status')}
         DROP CONSTRAINT IF EXISTS "account_verification_status_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('account_verification_status')}
         ADD CONSTRAINT "account_verification_status_status_check"
         CHECK ("status" IN ('pending', 'approved', 'rejected'))`,
    );
  }
}
