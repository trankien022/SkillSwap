import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

export class AddPushDeliveryLeasesAndReceipts1791072000007 implements MigrationInterface {
  name = 'AddPushDeliveryLeasesAndReceipts1791072000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    const deliveries = `"${SCHEMA}"."push_deliveries"`;
    await queryRunner.query(`ALTER TABLE ${deliveries}
      ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "receipt_status" text CHECK ("receipt_status" IN ('ok','error')),
      ADD COLUMN IF NOT EXISTS "receipt_attempts" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "next_receipt_at" timestamptz`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "ix_push_deliveries_receipt_due" ON "${SCHEMA}"."push_deliveries" ("status", "next_receipt_at") WHERE "status" = 'accepted' AND "receipt_status" IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${SCHEMA}"."ix_push_deliveries_receipt_due"`);
    await queryRunner.query(`ALTER TABLE "${SCHEMA}"."push_deliveries"
      DROP COLUMN IF EXISTS "next_receipt_at",
      DROP COLUMN IF EXISTS "receipt_attempts",
      DROP COLUMN IF EXISTS "receipt_status",
      DROP COLUMN IF EXISTS "lease_expires_at"`);
  }
}
