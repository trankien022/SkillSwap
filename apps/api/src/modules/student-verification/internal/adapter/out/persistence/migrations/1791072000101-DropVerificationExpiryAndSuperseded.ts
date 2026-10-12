import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-002 (ADR-023) developer decisions: approvals do not expire and there is no
 * `superseded` state. Drops `expires_at` and narrows the status CHECK to the
 * finite state set. Kept as a follow-up so the applied migration stays
 * append-only (ADR-014).
 */
export class DropVerificationExpiryAndSuperseded1791072000101 implements MigrationInterface {
  name = 'DropVerificationExpiryAndSuperseded1791072000101';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')} DROP COLUMN IF EXISTS "expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         DROP CONSTRAINT IF EXISTS "student_verifications_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         ADD CONSTRAINT "student_verifications_status_check"
         CHECK ("status" IN ('pending', 'approved', 'rejected'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')} ADD COLUMN IF NOT EXISTS "expires_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         DROP CONSTRAINT IF EXISTS "student_verifications_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('student_verifications')}
         ADD CONSTRAINT "student_verifications_status_check"
         CHECK ("status" IN ('pending', 'approved', 'rejected', 'superseded'))`,
    );
  }
}
