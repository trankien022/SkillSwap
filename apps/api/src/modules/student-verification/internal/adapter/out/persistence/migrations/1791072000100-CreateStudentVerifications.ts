import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-002 (ADR-023): student verification submissions and decisions. The partial
 * unique index enforces at most one effective (pending|approved) verification
 * per account (SR-BR-011); `expires_at` records the 365-day approval validity.
 */
export class CreateStudentVerifications1791072000100 implements MigrationInterface {
  name = 'CreateStudentVerifications1791072000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('student_verifications')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" text NOT NULL,
      "school_name" text NOT NULL,
      "major" text,
      "document_ref" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending'
        CHECK ("status" IN ('pending', 'approved', 'rejected', 'superseded')),
      "reviewer_id" text,
      "reason" text,
      "decided_at" timestamptz,
      "expires_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    // One effective verification per account (SR-BR-011 / ADR-023).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_student_verifications_effective"
         ON ${table('student_verifications')} ("account_id")
         WHERE "status" IN ('pending', 'approved')`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_student_verifications_account_status"
         ON ${table('student_verifications')} ("account_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('student_verifications')}`);
  }
}
