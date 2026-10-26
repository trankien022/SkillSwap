import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-012 in-class chat (ADR-036, Amendment A): the message log.
 *
 * **Append-only by design.** There is no `updated_at`, no soft-delete column and no edit or delete
 * endpoint: FR-012 describes messaging, not moderation, and the retention decision (ADR-036 C4)
 * was to keep messages. A column that invited an update would be a promise the product does not
 * make.
 *
 * **No `flagged` column.** ADR-036 originally carried a contact-sharing rule that might have
 * needed one; Amendment A withdrew that rule before this table existed, so nothing ever writes a
 * flag. Adding one now would be a column with no writer and no reader.
 *
 * `class_id` is denormalised alongside `booking_id` even though it could be joined. The read path
 * paginates a *class*'s conversation for both parties across that class's bookings, and doing so
 * without the column would mean joining `bookings` on the hot path for an immutable fact.
 * `sender_role` is text rather than an enum for the reason ADR-037 refused a `disputed` value in
 * an enum: a vocabulary that the domain already validates does not need a migration to change.
 *
 * Index `(class_id, created_at, id)` matches the keyset scan exactly -- ASC, because the thread is
 * served oldest-first -- so a page is an index range scan rather than a sort of the whole
 * conversation. The plan sketched it DESC, which assumed newest-first paging; the ordering the
 * client actually needs is the one that got the index.
 */
export class CreateClassChatMessages1791072000010 implements MigrationInterface {
  name = 'CreateClassChatMessages1791072000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('chat_messages')} (
      "id" uuid NOT NULL,
      "class_id" uuid NOT NULL,
      "booking_id" uuid NOT NULL,
      "sender_id" uuid NOT NULL,
      "sender_role" text NOT NULL,
      "body" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_chat_messages" PRIMARY KEY ("id"),
      CONSTRAINT "ck_chat_messages_sender_role" CHECK ("sender_role" IN ('learner', 'teacher')),
      CONSTRAINT "ck_chat_messages_body" CHECK (length("body") BETWEEN 1 AND 1000)
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_chat_messages_class_created"
         ON ${table('chat_messages')} ("class_id", "created_at", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('chat_messages')}`);
  }
}
