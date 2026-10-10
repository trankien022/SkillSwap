import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/** FR-020 (ADR-021): completion/cancellation audit fields for classes. */
export class AddClassCompletionColumns1791072000004 implements MigrationInterface {
  name = 'AddClassCompletionColumns1791072000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} ADD COLUMN IF NOT EXISTS "completed_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} ADD COLUMN IF NOT EXISTS "completion_basis" text`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} ADD COLUMN IF NOT EXISTS "cancellation_reason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} DROP COLUMN IF EXISTS "cancellation_reason"`,
    );
    await queryRunner.query(`ALTER TABLE ${table('classes')} DROP COLUMN IF EXISTS "cancelled_at"`);
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} DROP COLUMN IF EXISTS "completion_basis"`,
    );
    await queryRunner.query(`ALTER TABLE ${table('classes')} DROP COLUMN IF EXISTS "completed_at"`);
  }
}
