import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-019 (ADR-025): revocation columns and the `revoked` status. Widens the
 * status CHECK to include `revoked` and records when/why a verification was
 * revoked.
 */
export class AddVerificationRevocation1791072000103 implements MigrationInterface {
  name = 'AddVerificationRevocation1791072000103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')} ADD COLUMN IF NOT EXISTS "revoked_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')} ADD COLUMN IF NOT EXISTS "revocation_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         DROP CONSTRAINT IF EXISTS "student_verifications_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         ADD CONSTRAINT "student_verifications_status_check"
         CHECK ("status" IN ('pending', 'approved', 'rejected', 'revoked'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         DROP CONSTRAINT IF EXISTS "student_verifications_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         ADD CONSTRAINT "student_verifications_status_check"
         CHECK ("status" IN ('pending', 'approved', 'rejected'))`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')} DROP COLUMN IF EXISTS "revocation_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')} DROP COLUMN IF EXISTS "revoked_at"`,
    );
  }
}
