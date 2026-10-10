import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-003 / ADR-024: this module's local projection of the `student.verification.*`
 * events so it can gate evidence submission on "is a verified student" without a
 * cross-schema read (ADR-014). Event-fed + idempotent (ADR-013); a missing row
 * means the account never submitted a verification.
 */
export class CreateVerifiedStudentProjection1791072000601 implements MigrationInterface {
  name = 'CreateVerifiedStudentProjection1791072000601';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('verified_students')} (
      "account_id" text PRIMARY KEY,
      "status" text NOT NULL CHECK ("status" IN ('pending', 'approved', 'rejected', 'revoked')),
      "occurred_at" timestamptz NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('verified_students')}`);
  }
}
