import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-008 (ADR-017): wallet balances and top-up intents. Extends `ledger_entries`
 * so top-up/reversal entries (which have no booking) can be recorded alongside
 * the existing teacher-credit entries.
 */
export class CreateWalletTopUpTables1791072000001 implements MigrationInterface {
  name = 'CreateWalletTopUpTables1791072000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('wallets')} (
      "owner_id" text PRIMARY KEY,
      "available_credits" integer NOT NULL DEFAULT 0,
      "pending_credits" integer NOT NULL DEFAULT 0 CHECK ("pending_credits" >= 0),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('top_up_intents')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "owner_id" text NOT NULL,
      "provider" text NOT NULL,
      "provider_ref" text NOT NULL,
      "amount_vnd" integer NOT NULL CHECK ("amount_vnd" > 0),
      "amount_credits" integer NOT NULL CHECK ("amount_credits" > 0),
      "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'settled', 'failed', 'reversed')),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_top_up_intents_provider_ref" UNIQUE ("provider", "provider_ref")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_top_up_intents_owner" ON ${table('top_up_intents')} ("owner_id")`,
    );

    // Ledger entries now cover both bookings and top-ups.
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} ALTER COLUMN "booking_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} DROP CONSTRAINT IF EXISTS "ledger_entries_booking_id_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} ADD COLUMN IF NOT EXISTS "entry_type" text NOT NULL DEFAULT 'teacher_credit'`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} ADD COLUMN IF NOT EXISTS "owner_id" text`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} ADD COLUMN IF NOT EXISTS "reference_id" text`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('ledger_entries')} ADD COLUMN IF NOT EXISTS "trace_id" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${table('ledger_entries')} DROP COLUMN IF EXISTS "trace_id"`);
    await queryRunner.query(`ALTER TABLE ${table('ledger_entries')} DROP COLUMN IF EXISTS "reference_id"`);
    await queryRunner.query(`ALTER TABLE ${table('ledger_entries')} DROP COLUMN IF EXISTS "owner_id"`);
    await queryRunner.query(`ALTER TABLE ${table('ledger_entries')} DROP COLUMN IF EXISTS "entry_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('top_up_intents')}`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('wallets')}`);
  }
}
