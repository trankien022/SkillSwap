import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-004 / ADR-027: Verifier accounts with a **seeded** expertise set, plus the
 * evidence **claim** state (a distinct action that locks a request to one Verifier,
 * permanently and with no release).
 *
 * - `verifiers`: account_id, lifecycle status (`active|suspended|revoked`). Seeded
 *   operationally; there is no admin create/assign API.
 * - `verifier_expertise`: the skills a Verifier may review (many per Verifier).
 * - `skill_evidence` gains `claimed_by`/`claimed_at` and a `claimed` status.
 */
export class CreateVerifiersAndEvidenceClaim1791072000602 implements MigrationInterface {
  name = 'CreateVerifiersAndEvidenceClaim1791072000602';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('verifiers')} (
      "account_id" text PRIMARY KEY,
      "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'suspended', 'revoked')),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('verifier_expertise')} (
      "account_id" text NOT NULL REFERENCES ${table('verifiers')} ("account_id") ON DELETE CASCADE,
      "skill_id" uuid NOT NULL,
      PRIMARY KEY ("account_id", "skill_id")
    )`);

    // Evidence claim state (BR-071). A pending request becomes `claimed` once exactly
    // one Verifier takes it; that claim is never released in the MVP.
    await queryRunner.query(
      `ALTER TABLE ${table('skill_evidence')} ADD COLUMN IF NOT EXISTS "claimed_by" text`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('skill_evidence')} ADD COLUMN IF NOT EXISTS "claimed_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('skill_evidence')} DROP CONSTRAINT IF EXISTS "skill_evidence_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('skill_evidence')} ADD CONSTRAINT "skill_evidence_status_check"
         CHECK ("status" IN ('pending', 'claimed', 'approved', 'rejected', 'superseded'))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_skill_evidence_claimed" ON ${table('skill_evidence')} ("claimed_by")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('skill_evidence')} DROP CONSTRAINT IF EXISTS "skill_evidence_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('skill_evidence')} ADD CONSTRAINT "skill_evidence_status_check"
         CHECK ("status" IN ('pending', 'approved', 'rejected', 'superseded'))`,
    );
    await queryRunner.query(`ALTER TABLE ${table('skill_evidence')} DROP COLUMN IF EXISTS "claimed_at"`);
    await queryRunner.query(`ALTER TABLE ${table('skill_evidence')} DROP COLUMN IF EXISTS "claimed_by"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('verifier_expertise')}`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('verifiers')}`);
  }
}
