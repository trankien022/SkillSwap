import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/** Classes and bookings for FR-005/FR-007 (one Class per scheduled session). */
export class CreateClassBookingTables1791072000001 implements MigrationInterface {
  name = 'CreateClassBookingTables1791072000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('classes')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "teacher_id" text NOT NULL,
      "state" text NOT NULL CHECK ("state" IN ('draft', 'published', 'full', 'in_progress', 'completed', 'cancelled')),
      "starts_at" timestamptz NOT NULL,
      "duration_minutes" integer NOT NULL CHECK ("duration_minutes" BETWEEN 30 AND 180),
      "price_credits" integer NOT NULL CHECK ("price_credits" > 0),
      "capacity" integer NOT NULL CHECK ("capacity" >= 1),
      "description" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_classes_teacher_starts" ON ${table('classes')} ("teacher_id", "starts_at")`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('class_skills')} (
      "class_id" uuid NOT NULL REFERENCES ${table('classes')} ("id") ON DELETE CASCADE,
      "skill_id" text NOT NULL,
      PRIMARY KEY ("class_id", "skill_id")
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('bookings')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "class_id" uuid NOT NULL REFERENCES ${table('classes')} ("id"),
      "learner_id" text NOT NULL,
      "state" text NOT NULL CHECK ("state" IN ('pending', 'confirmed', 'completed', 'cancelled', 'disputed')),
      "price_credits" integer NOT NULL CHECK ("price_credits" > 0),
      "idempotency_key" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_bookings_idempotency_key" UNIQUE ("idempotency_key")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_bookings_class_state" ON ${table('bookings')} ("class_id", "state")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_bookings_active_learner_class" ON ${table('bookings')} ("class_id", "learner_id") WHERE "state" IN ('pending', 'confirmed', 'completed', 'disputed')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['bookings', 'class_skills', 'classes']) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table(name)}`);
    }
  }
}
