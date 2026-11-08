import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * The level a class is taught at (B2).
 *
 * Every client derived a level from the *skill catalogue* (`skill.levels[0]` — the lowest level the
 * skill supports, not the level this class is taught at), and the web rendered a `: 'C2'` fallback
 * on top, so a wrong badge was not even visible as wrong. The level is a fact about the class.
 *
 * Backfill reads `teacher_skill_approval`, which is in this schema, so the join is legal
 * (ADR-014). It only fills classes with **exactly one** skill: a teacher approved at `advanced` for
 * React and `beginner` for TypeScript publishes a two-skill class, and which level that class is
 * taught at is not recorded anywhere. Picking the first skill would be a guess that later reads as
 * data; those rows stay `NULL` and render no badge.
 *
 * The column stays nullable for the same reason, even though every newly published class gets a
 * level from the publish gate (which requires an approval for every skill).
 */
export class AddClassLevel1791072000012 implements MigrationInterface {
  name = 'AddClassLevel1791072000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${table('classes')} ADD COLUMN IF NOT EXISTS "level" text`);

    await queryRunner.query(`
      UPDATE ${table('classes')} c
         SET "level" = a."approved_level"
        FROM ${table('class_skills')} s, ${table('teacher_skill_approval')} a
       WHERE s."class_id" = c."id"
         AND a."skill_id" = s."skill_id"
         AND a."account_id" = c."teacher_id"
         AND c."level" IS NULL
         AND a."approved_level" IS NOT NULL
         AND (SELECT COUNT(*) FROM ${table('class_skills')} s2 WHERE s2."class_id" = c."id") = 1
    `);

    await queryRunner.query(
      `ALTER TABLE ${table('classes')} ADD CONSTRAINT "ck_classes_level"
         CHECK ("level" IS NULL OR "level" IN ('beginner', 'intermediate', 'advanced', 'expert'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} DROP CONSTRAINT IF EXISTS "ck_classes_level"`,
    );
    await queryRunner.query(`ALTER TABLE ${table('classes')} DROP COLUMN IF EXISTS "level"`);
  }
}
