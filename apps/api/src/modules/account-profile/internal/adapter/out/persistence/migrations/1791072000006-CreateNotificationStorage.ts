import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';
function table(name: string): string { return `"${SCHEMA}"."${name}"`; }

/** ADR-031: account-owned push subscriptions and durable notification inbox. */
export class CreateNotificationStorage1791072000006 implements MigrationInterface {
  name = 'CreateNotificationStorage1791072000006';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('notification_devices')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "account_id" uuid NOT NULL,
      "token" text NOT NULL UNIQUE, "platform" text NOT NULL CHECK ("platform" IN ('ios','android','web')),
      "installation_id" text NOT NULL UNIQUE, "app_version" text, "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "ix_notification_devices_account" ON ${table('notification_devices')} ("account_id", "is_active")`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('inbox_notifications')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "account_id" uuid NOT NULL,
      "deduplication_key" text NOT NULL UNIQUE,
      "type" text NOT NULL CHECK ("type" IN ('verification_outcome','booking_confirmed','booking_cancelled','class_starting_soon','wallet_transaction','withdrawal_outcome')),
      "title" text NOT NULL, "body" text NOT NULL,
      "target_type" text NOT NULL CHECK ("target_type" IN ('class','booking','wallet','verification')),
      "target_id" text NOT NULL, "read" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "ix_inbox_account_created" ON ${table('inbox_notifications')} ("account_id", "created_at" DESC, "id" DESC)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('push_deliveries')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "notification_id" uuid NOT NULL REFERENCES ${table('inbox_notifications')} ("id") ON DELETE CASCADE,
      "device_id" uuid NOT NULL REFERENCES ${table('notification_devices')} ("id") ON DELETE CASCADE,
      "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','sending','accepted','failed')),
      "attempts" integer NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
      "provider_ticket_id" text, "last_error" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_push_delivery_notification_device" UNIQUE ("notification_id", "device_id")
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "ix_push_deliveries_due" ON ${table('push_deliveries')} ("status", "next_attempt_at", "created_at")`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${SCHEMA}"."ix_push_deliveries_due"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('push_deliveries')}`);
    await queryRunner.query(`DROP INDEX IF EXISTS "${SCHEMA}"."ix_inbox_account_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('inbox_notifications')}`);
    await queryRunner.query(`DROP INDEX IF EXISTS "${SCHEMA}"."ix_notification_devices_account"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('notification_devices')}`);
  }
}
