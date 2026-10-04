import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

const TABLES = ['module_status', 'outbox_messages', 'processed_events', 'ledger_entries'];

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/** Creates the Wallet ledger module tables (one schema per module, ARCHITECTURE.md §5). */
export class CreateModuleTables1791072000000 implements MigrationInterface {
  name = 'CreateModuleTables1791072000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('module_status')} (
      "id" integer PRIMARY KEY CHECK ("id" = 1),
      "state" text NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `INSERT INTO ${table('module_status')} ("id", "state") VALUES (1, 'active') ON CONFLICT ("id") DO NOTHING`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('outbox_messages')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_type" text NOT NULL,
      "payload" jsonb NOT NULL,
      "status" text NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'PUBLISHED', 'DEAD')),
      "attempts" integer NOT NULL DEFAULT 0,
      "last_error" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "published_at" timestamptz
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_outbox_messages_status_created" ON ${table('outbox_messages')} ("status", "created_at")`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('processed_events')} (
      "id" text PRIMARY KEY,
      "status" text NOT NULL DEFAULT 'PROCESSING' CHECK ("status" IN ('PROCESSING', 'DONE', 'FAILED')),
      "error" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "processed_at" timestamptz
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('ledger_entries')} (
      "id" bigserial PRIMARY KEY,
      "booking_id" text NOT NULL UNIQUE,
      "teacher_id" text NOT NULL,
      "amount_credits" integer NOT NULL CHECK ("amount_credits" > 0),
      "direction" text NOT NULL CHECK ("direction" IN ('credit', 'debit')),
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [...TABLES].reverse()) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table(name)}`);
    }
  }
}
