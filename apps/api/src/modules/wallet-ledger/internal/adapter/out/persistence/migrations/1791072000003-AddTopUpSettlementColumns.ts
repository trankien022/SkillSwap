import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-008 (ADR-033): record what the SePay Payment Gateway actually settled.
 *
 * `provider_ref` stays the SePay `order_invoice_number`, but the provider also
 * issues its own `order_id` and reports the captured amount and time. Those are
 * stored so reconciliation (and support) can prove an intent against the
 * provider's own record rather than trusting our own copy of the request.
 */
export class AddTopUpSettlementColumns1791072000003 implements MigrationInterface {
  name = 'AddTopUpSettlementColumns1791072000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')} ADD COLUMN IF NOT EXISTS "provider_order_id" text`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')} ADD COLUMN IF NOT EXISTS "paid_amount_vnd" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')} ADD COLUMN IF NOT EXISTS "paid_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')} DROP COLUMN IF EXISTS "paid_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')} DROP COLUMN IF EXISTS "paid_amount_vnd"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')} DROP COLUMN IF EXISTS "provider_order_id"`,
    );
  }
}
