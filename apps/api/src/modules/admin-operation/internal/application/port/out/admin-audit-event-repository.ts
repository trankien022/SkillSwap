import type { AuditEvent } from '@skillswap/contracts';
import type { AdminAuditEventInput } from '../../../domain/audit-event';

export const ADMIN_AUDIT_EVENT_REPOSITORY = Symbol('AdminAuditEventRepository');

/** FR-015: one page of the audit log plus the filtered total (NFR-014). */
export interface AdminAuditPage {
  readonly items: AuditEvent[];
  readonly nextCursor: string | null;
  readonly total: number;
}

/** FR-015: the filters the audit log accepts, mirroring `auditLogQuerySchema`. */
export interface AdminAuditQuery {
  readonly limit: number;
  readonly cursor?: string;
  /** Who acted. */
  readonly actorId?: string;
  /** The dotted action identifier, exactly as stored. */
  readonly action?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  /** Inclusive lower bound on `occurredAt`. */
  readonly from?: Date;
  /** Inclusive upper bound on `occurredAt`. */
  readonly to?: Date;
  /** Free-text match over the target id. */
  readonly q?: string;
  readonly sort?: 'occurredAt' | '-occurredAt';
}

/**
 * FR-015 / ADR-034: the append-only audit store.
 *
 * There is intentionally no `update` or `delete`: an audit log you can rewrite is not an audit
 * log (NFR-005). `append` is idempotent on `sourceEventId`, so a redelivered event appends
 * nothing rather than duplicating a row.
 */
export interface AdminAuditEventRepository {
  /**
   * Appends one row, or does nothing when a row with the same `sourceEventId` already exists.
   * Returns true when a row was written.
   */
  append(input: AdminAuditEventInput): Promise<boolean>;
  /** The filtered, keyset-paged log (newest first by default). */
  list(query: AdminAuditQuery): Promise<AdminAuditPage>;
}
