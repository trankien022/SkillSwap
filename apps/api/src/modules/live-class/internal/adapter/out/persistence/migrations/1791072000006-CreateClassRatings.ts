import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string { return `"${SCHEMA}"."${name}"`; }

/** FR-013 / ADR-031: one immutable rating per eligible booking. */
export class CreateClassRatings1791072000006 implements MigrationInterface {
  name = 'CreateClassRatings1791072000006';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('ratings')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "booking_id" uuid NOT NULL REFERENCES ${table('bookings')} ("id"),
      "class_id" uuid NOT NULL REFERENCES ${table('classes')} ("id"),
      "learner_id" uuid NOT NULL,
      "stars" smallint NOT NULL CHECK ("stars" BETWEEN 1 AND 5),
      "comment" text NOT NULL CHECK (length(trim("comment")) BETWEEN 1 AND 1000),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_ratings_booking_id" UNIQUE ("booking_id")
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "ix_ratings_class_created" ON ${table('ratings')} ("class_id", "created_at" DESC, "id" DESC)`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${SCHEMA}"."ix_ratings_class_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('ratings')}`);
  }
}
