import type { AuditLogPage, AuditLogQueryInput } from '@skillswap/contracts';

export const LIST_AUDIT_LOG = Symbol('ListAuditLog');

/**
 * FR-015: the Administrator's audit log.
 *
 * A read-only projection of privileged actions (ADR-034). Authorization is the controller's
 * (`@Roles('admin')`): there is no "my own audit log", so the port takes no caller identity.
 */
export interface ListAuditLogPort {
  execute(query: AuditLogQueryInput): Promise<AuditLogPage>;
}
