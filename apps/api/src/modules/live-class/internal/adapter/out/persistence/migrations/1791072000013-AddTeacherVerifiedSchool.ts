import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * The school a Teacher was verified at (B4).
 *
 * `studentVerificationEventSchema.schoolName` already carried it; the projection writer dropped it,
 * so the web's university filter had nothing to filter on.
 *
 * **No backfill.** The source of truth is `student_verification.student_verifications.school_name`,
 * which is another schema, and cross-schema reads are forbidden (ADR-014). Existing rows keep
 * `NULL` — which the read path reports honestly as "no school" — until the account's next
 * `student.verification.*` event lands or the outbox is replayed. `scripts/seed-demo.mjs` writes
 * the projection directly so a demo database has real schools (B4 step 7).
 */
export class AddTeacherVerifiedSchool1791072000013 implements MigrationInterface {
  name = 'AddTeacherVerifiedSchool1791072000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('teacher_verified')} ADD COLUMN IF NOT EXISTS "school_name" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('teacher_verified')} DROP COLUMN IF EXISTS "school_name"`,
    );
  }
}
