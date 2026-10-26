import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * BR-027 (decision D3): snapshot the exchange rate each top-up intent was priced at.
 *
 * The rate used to be the constant `VND_PER_CREDIT = 1000` at `wallet.ts:4`. It is now
 * configuration (`VND_PER_CREDIT`), which raises a question the constant could not: what does an
 * intent created under one rate mean after the rate changes? The answer has to be a snapshot,
 * because a payer who opened a checkout at 1,000 VND per credit must not be re-priced while the
 * money is in flight, and no later read can reconstruct a rate it never stored.
 *
 * The column is `NOT NULL DEFAULT 1000` deliberately. 1,000 is the only rate that ever existed
 * before this column, so the default is a fact about the data, not a guess — every existing row
 * was in fact priced at 1,000. A nullable column would have forced every reader to invent a
 * fallback and would have let a future insert forget the snapshot entirely.
 *
 * Integer, matching the domain's "no floats for money" rule (AGENTS.md): a fractional VND
 * per credit does not exist, and `vndToCredits` refuses one.
 */
export class AddTopUpVndPerCredit1791072000602 implements MigrationInterface {
  name = 'AddTopUpVndPerCredit1791072000602';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')}
         ADD COLUMN IF NOT EXISTS "vnd_per_credit" integer NOT NULL DEFAULT 1000`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')}
         DROP CONSTRAINT IF EXISTS "ck_top_up_intents_vnd_per_credit_positive"`,
    );
    // A zero or negative rate would make the stored credits meaningless. The application
    // already refuses one at boot; this makes the invariant true in the data as well.
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')}
         ADD CONSTRAINT "ck_top_up_intents_vnd_per_credit_positive"
         CHECK ("vnd_per_credit" > 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')}
         DROP CONSTRAINT IF EXISTS "ck_top_up_intents_vnd_per_credit_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('top_up_intents')} DROP COLUMN IF EXISTS "vnd_per_credit"`,
    );
  }
}
