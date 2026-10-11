import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-003 / ADR-026: the skill taxonomy and the evidence submission chain.
 *
 * - `skills`: the managed, admin-seeded catalogue, a two-level `category → skill`
 *   tree (ADR-026 §1–2). Evidence must reference a known, active skill.
 * - `profile_skills`: links an account to a skill and caches the **effective
 *   approved level** (`NULL` until a Verifier approves — FR-004). One row per
 *   (account, skill).
 * - `skill_evidence`: one immutable row per submission **version**; statuses
 *   `pending → approved | rejected | superseded` (FR-004/FR-018 decide the rest).
 *   Version is unique per profile-skill.
 *
 * Levels use the fixed ordered scale `beginner | intermediate | advanced | expert`
 * (ADR-026 §3). `account_id`/`reviewer_id` are opaque identity ids (no cross-schema
 * FKs, ADR-014); this supersedes the pre-decision `skill_level { begin, mid, senior }`
 * draft in `docs/diagrams/data/skillswap-logical.dbml`.
 */
export class CreateSkillEvidence1791072000600 implements MigrationInterface {
  name = 'CreateSkillEvidence1791072000600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('skills')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(160) NOT NULL,
      "category" varchar(160) NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("name", "category")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_skills_category" ON ${table('skills')} ("category")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('profile_skills')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "account_id" text NOT NULL,
      "skill_id" uuid NOT NULL,
      "approved_level" text CHECK ("approved_level" IN ('beginner', 'intermediate', 'advanced', 'expert')),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("account_id", "skill_id")
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('skill_evidence')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "profile_skill_id" uuid NOT NULL REFERENCES ${table('profile_skills')} ("id") ON DELETE CASCADE,
      "evidence_type" varchar(24) NOT NULL CHECK ("evidence_type" IN ('certificate', 'verifier_assessment')),
      "document_ref" text,
      "description" text,
      "version" integer NOT NULL CHECK ("version" > 0),
      "requested_level" text NOT NULL CHECK ("requested_level" IN ('beginner', 'intermediate', 'advanced', 'expert')),
      "approved_level" text CHECK ("approved_level" IN ('beginner', 'intermediate', 'advanced', 'expert')),
      "status" varchar(24) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected', 'superseded')),
      "reviewer_id" text,
      "reason" text,
      "submitted_at" timestamptz NOT NULL DEFAULT now(),
      "decided_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("profile_skill_id", "version")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_skill_evidence_status_submitted" ON ${table('skill_evidence')} ("status", "submitted_at")`,
    );
    // At most one approved version per profile-skill (the effective approval).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_skill_evidence_approved" ON ${table('skill_evidence')} ("profile_skill_id") WHERE "status" = 'approved'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('skill_evidence')}`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('profile_skills')}`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('skills')}`);
  }
}
