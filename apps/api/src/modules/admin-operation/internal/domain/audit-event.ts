/**
 * FR-015 / ADR-034: the Admin audit log.
 *
 * The general SRS `AuditEvent` row, owned by this module. It is a **projection**: privileged
 * actions in other bounded contexts already publish through the ADR-013 outbox, and this module
 * consumes those events and appends one row each. Nothing here reaches into another module's
 * schema (ADR-014), and this module never learns it is being audited by any module's code — the
 * coupling is one-directional and event-driven, exactly as ADR-013 established.
 *
 * Append-only (NFR-005): `AdminAuditEventRepository` exposes an `append`, never an update or a
 * delete, and the schema grants the module role no `UPDATE`/`DELETE` on the table.
 *
 * Framework-free: no NestJS, no TypeORM.
 */

export const MODULE_NAME = 'admin-operation';

/** The audit row's own fields, before the store assigns an id. */
export interface AdminAuditEventInput {
  readonly actorId: string | null;
  /** A dotted identifier, e.g. `student.verification.approved`. */
  readonly action: string;
  /** What the action was performed on, e.g. `verification`. */
  readonly targetType: string;
  readonly targetId: string | null;
  /** Whitelisted scalar snapshots; never document contents (NFR-005). */
  readonly oldState: Readonly<Record<string, string | number | boolean | null>> | null;
  readonly newState: Readonly<Record<string, string | number | boolean | null>> | null;
  readonly occurredAt: Date;
  readonly traceId: string | null;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>> | null;
  /** The originating domain event id; makes ingestion idempotent (ADR-013/ADR-034 §6). */
  readonly sourceEventId: string | null;
}

/**
 * The subset of a bus message the audit mapping needs.
 *
 * Declared here rather than imported from `shared/messaging` because an application-layer type
 * may not depend on `shared` (ADR-009), and declared in the domain rather than in the mapping or
 * the use case so neither has to import the other.
 */
export interface AuditableMessage {
  readonly id: string;
  readonly eventType: string;
  readonly payload: unknown;
}
