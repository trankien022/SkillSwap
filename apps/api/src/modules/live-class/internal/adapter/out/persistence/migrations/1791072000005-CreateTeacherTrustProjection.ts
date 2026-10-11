import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-005 / ADR-024 (extension): `live-class`'s local projection of a Teacher's publish
 * rights, fed by `student.verification.*` and `skill.evidence.*` events (no cross-schema
 * read, ADR-014).
 *
 * - `teacher_verified`: whether the account is a currently verified student.
 * - `teacher_skill_approval`: the effective approved level per (account, skill).
 */
export class CreateTeacherTrustProjection1791072000005 implements MigrationInterface {
  name = 'CreateTeacherTrustProjection1791072000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('teacher_verified')} (
      "account_id" text PRIMARY KEY,
      "verified" boolean NOT NULL,
      "occurred_at" timestamptz NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('teacher_skill_approval')} (
      "account_id" text NOT NULL,
      "skill_id" text NOT NULL,
      "approved_level" text CHECK ("approved_level" IN ('beginner', 'intermediate', 'advanced', 'expert')),
      "occurred_at" timestamptz NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("account_id", "skill_id")
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('teacher_skill_approval')}`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('teacher_verified')}`);
  }
}
