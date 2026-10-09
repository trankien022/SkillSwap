import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/** Accounts, credentials and refresh sessions for FR-001 (ADR-016). */
export class CreateAccountTables1791072000001 implements MigrationInterface {
  name = 'CreateAccountTables1791072000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('accounts')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" text NOT NULL,
      "display_name" text NOT NULL,
      "role" text NOT NULL CHECK ("role" IN ('learner', 'teacher', 'admin')),
      "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'suspended')),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_accounts_email" ON ${table('accounts')} (lower("email"))`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('account_credentials')} (
      "account_id" uuid PRIMARY KEY REFERENCES ${table('accounts')} ("id") ON DELETE CASCADE,
      "algorithm" text NOT NULL,
      "salt" text NOT NULL,
      "hash" text NOT NULL,
      "key_length" integer NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('sessions')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" uuid NOT NULL REFERENCES ${table('accounts')} ("id") ON DELETE CASCADE,
      "refresh_token_hash" text NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "revoked_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_sessions_token_hash" ON ${table('sessions')} ("refresh_token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_sessions_account" ON ${table('sessions')} ("account_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['sessions', 'account_credentials', 'accounts']) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table(name)}`);
    }
  }
}
