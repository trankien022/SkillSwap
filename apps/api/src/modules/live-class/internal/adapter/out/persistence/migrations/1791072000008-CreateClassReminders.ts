import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-016 (W3): one row per reminder actually sent, so a class is reminded exactly once.
 *
 * The unique key `(class_id, kind)` **is** the lease. Two API instances sweeping the same minute
 * both try to claim; the `ON CONFLICT DO NOTHING` in the claim statement decides which one wins,
 * and the loser skips. That is why there is no advisory lock and no lease column: the database
 * already knows how to let exactly one writer through, and a hand-rolled lease would be a second
 * mechanism that can disagree with the first.
 *
 * `kind` is text rather than an enum because reminders are a growing family (starting soon today;
 * an ending-soon or a follow-up reminder later would be another kind for the same class). An enum
 * would need a migration to add a value; the write path validates the value in the domain instead.
 *
 * `class_id` is `uuid` here, unlike `class_presence.class_id` which is `text` because it carries
 * Jitsi's room-derived identifier. A reminder is always about a class we created, so the honest
 * type is available and the foreign-key-shaped join stays clean within this schema.
 */
export class CreateClassReminders1791072000008 implements MigrationInterface {
  name = 'CreateClassReminders1791072000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('class_reminders')} (
      "class_id" uuid NOT NULL REFERENCES ${table('classes')} ("id") ON DELETE CASCADE,
      "kind" text NOT NULL,
      "sent_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_class_reminders" PRIMARY KEY ("class_id", "kind")
    )`);
    // The sweep asks "what was reminded in this window?" when reconciling, and an operator asks
    // "when was this class reminded?"; both walk time, not the composite key.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_class_reminders_sent_at"
         ON ${table('class_reminders')} ("sent_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('class_reminders')}`);
  }
}
