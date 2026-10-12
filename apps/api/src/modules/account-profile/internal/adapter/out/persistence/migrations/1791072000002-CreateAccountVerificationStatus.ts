import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-017 / ADR-024: local projection of the student verification status, fed by
 * `student.verification.*` events (no cross-schema reads). One row per account
 * that has a verification; a missing row means "never submitted".
 */
export class CreateAccountVerificationStatus1791072000002 implements MigrationInterface {
  name = 'CreateAccountVerificationStatus1791072000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('account_verification_status')} (
      "account_id" text PRIMARY KEY,
      "status" text NOT NULL CHECK ("status" IN ('pending', 'approved', 'rejected')),
      "reason" text,
      "verification_id" text NOT NULL,
      "occurred_at" timestamptz NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('account_verification_status')}`);
  }
}
