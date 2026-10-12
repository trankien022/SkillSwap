import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-018 / ADR-028: append-only evidence decision history. One row per lifecycle
 * change, written in the same transaction as the change (BR-014, NFR-005). The
 * `snapshot` is a whitelisted JSON copy of decision-relevant fields, never document
 * contents. Rows are never updated or deleted.
 */
export class CreateSkillEvidenceAudit1791072000603 implements MigrationInterface {
  name = 'CreateSkillEvidenceAudit1791072000603';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('skill_evidence_audit')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "evidence_id" uuid NOT NULL,
      "profile_skill_id" uuid NOT NULL,
      "version" integer NOT NULL CHECK ("version" > 0),
      "action" text NOT NULL CHECK ("action" IN ('submitted', 'claimed', 'approved', 'rejected', 'superseded')),
      "actor_id" text,
      "from_status" text,
      "to_status" text NOT NULL,
      "reason" text,
      "snapshot" jsonb NOT NULL,
      "occurred_at" timestamptz NOT NULL,
      "trace_id" text,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_skill_evidence_audit_profile_skill" ON ${table('skill_evidence_audit')} ("profile_skill_id", "version", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_skill_evidence_audit_evidence" ON ${table('skill_evidence_audit')} ("evidence_id", "occurred_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('skill_evidence_audit')}`);
  }
}
