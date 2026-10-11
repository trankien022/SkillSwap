import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-002 / ADR-023 (developer decision 4): document metadata in Postgres. The
 * bytes live in S3 (pre-signed upload); this row records owner, object key,
 * declared type/size and whether the document is attached to a submission.
 */
export class CreateVerificationDocuments1791072000102 implements MigrationInterface {
  name = 'CreateVerificationDocuments1791072000102';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('verification_documents')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" text NOT NULL,
      "object_key" text NOT NULL,
      "file_name" text NOT NULL,
      "content_type" text NOT NULL,
      "size_bytes" bigint NOT NULL CHECK ("size_bytes" > 0),
      "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'attached')),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_verification_documents_account" ON ${table('verification_documents')} ("account_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('verification_documents')}`);
  }
}
