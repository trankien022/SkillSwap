import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-015 / ADR-034: the append-only Admin audit log.
 *
 * This is a **projection** of privileged actions that other modules already publish through the
 * ADR-013 outbox, so it holds no foreign keys and joins nothing — ADR-014 forbids cross-schema
 * references, and an audit row must survive the thing it describes being deleted anyway.
 *
 * `source_event_id` carries the originating event id. Its unique index is **partial** (only where
 * the column is not null) for two reasons: rows written without an event have no id and must not
 * collide with each other, and `ON CONFLICT ... WHERE "source_event_id" IS NOT NULL` can only use
 * a partial index. That index is the second line of idempotency defence behind
 * `processed_events`, so a reset or a race cannot duplicate an audit row.
 *
 * The supporting indexes are the ones the three FR-015 filters need: `(occurred_at, id)` serves
 * the default newest-first keyset page and any time range; `(actor_id, occurred_at)` serves the
 * actor filter. `action` is deliberately left to the `(occurred_at, id)` scan until it earns an
 * index — the SRS filter is actor + time + action together, and a single-column index on a
 * high-cardinality `action` would not be chosen over the time-ordered one.
 *
 * Retention: no pruning in the MVP (OQ-008 / ADR-023 precedent). The table is expected to grow.
 */
export class CreateAdminAuditEvent1791072000001 implements MigrationInterface {
  name = 'CreateAdminAuditEvent1791072000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('admin_audit_event')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "actor_id" text,
      "action" text NOT NULL,
      "target_type" text NOT NULL,
      "target_id" text,
      "old_state" jsonb,
      "new_state" jsonb,
      "occurred_at" timestamptz NOT NULL,
      "trace_id" text,
      "metadata" jsonb,
      "source_event_id" text,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_admin_audit_event_occurred"
         ON ${table('admin_audit_event')} ("occurred_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_admin_audit_event_actor_occurred"
         ON ${table('admin_audit_event')} ("actor_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_admin_audit_event_source_event"
         ON ${table('admin_audit_event')} ("source_event_id")
         WHERE "source_event_id" IS NOT NULL`,
    );

    // NFR-005 / ADR-034: append-only is a property of the deployment, not only of the code.
    // The module's role owns the schema, so a REVOKE cannot restrict it — ownership always
    // implies the privilege. The statement is kept because it is what makes the guarantee
    // meaningful the moment privileges are handed to a narrower role, and it documents the
    // intent at the schema level. Until then the guarantee rests on this repository having no
    // update or delete path at all.
    const role = `"skillswap_${SCHEMA}"`;
    await queryRunner.query(`REVOKE UPDATE, DELETE ON ${table('admin_audit_event')} FROM ${role}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('admin_audit_event')}`);
  }
}
