import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/** FR-007 lifecycle remainder (ADR-019): hold expiry and cancellation metadata. */
export class AddBookingLifecycleColumns1791072000002 implements MigrationInterface {
  name = 'AddBookingLifecycleColumns1791072000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} ADD COLUMN IF NOT EXISTS "expires_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} ADD COLUMN IF NOT EXISTS "confirmed_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} ADD COLUMN IF NOT EXISTS "cancel_reason" text`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_bookings_expiry" ON ${table('bookings')} ("state", "expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ${table('ix_bookings_expiry')}`);
    await queryRunner.query(`ALTER TABLE ${table('bookings')} DROP COLUMN IF EXISTS "cancel_reason"`);
    await queryRunner.query(`ALTER TABLE ${table('bookings')} DROP COLUMN IF EXISTS "cancelled_at"`);
    await queryRunner.query(`ALTER TABLE ${table('bookings')} DROP COLUMN IF EXISTS "confirmed_at"`);
    await queryRunner.query(`ALTER TABLE ${table('bookings')} DROP COLUMN IF EXISTS "expires_at"`);
  }
}
