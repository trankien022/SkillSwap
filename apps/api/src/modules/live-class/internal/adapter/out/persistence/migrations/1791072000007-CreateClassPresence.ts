import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-011 / FR-020 (AC-035): room presence, one row per participant session.
 *
 * `left_at IS NULL` means "still in the room". A partial unique index allows at most
 * one open session per (class, participant), which is what makes a redelivered
 * `participant-joined` a no-op instead of a second session that would keep the room
 * looking occupied forever.
 */
export class CreateClassPresence1791072000007 implements MigrationInterface {
  name = 'CreateClassPresence1791072000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('class_presence')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "class_id" text NOT NULL,
      "account_id" text NOT NULL,
      "joined_at" timestamptz NOT NULL,
      "left_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_class_presence_open_session"
         ON ${table('class_presence')} ("class_id", "account_id") WHERE "left_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_class_presence_class"
         ON ${table('class_presence')} ("class_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('class_presence')}`);
  }
}
