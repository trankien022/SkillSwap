import { z } from 'zod';
import { pagedSchema, paginationQuerySchema } from './pagination';

/**
 * FR-015 / ADR-028 §4 / ADR-034: the **general** audit event contract.
 *
 * ADR-028 §4 committed to "a Zod `auditEventSchema` in `packages/contracts` matching the SRS
 * `AuditEvent` row" as the artifact FR-015 would consume. The evidence-scoped shape FR-018
 * actually shipped is a different thing (keyed by `evidenceId`/`version`, closed action list),
 * so it now lives as `evidenceAuditEventSchema` and this file owns the general row:
 * `id, actor_id, action, target_type, target_id, old_state_json, new_state_json, occurred_at,
 * trace_id, metadata_json`. ADR-034 §1 records the divergence and the split.
 *
 * The contract is deliberately **generic**: `action` and `targetType` are open sets of
 * dotted identifiers (`student.verification.approved`, `target: verification`), because
 * FR-015 aggregates privileged actions from several bounded contexts (ADR-034 §2) and a
 * closed enum here would force every new audited behaviour to edit a shared contract.
 * Validation of *which* actions are known is the ingest side's job (ADR-034 §3), not the
 * wire shape's.
 */

/**
 * A dotted action identifier: `<domain>.<subject>.<verb>`.
 *
 * Examples: `student.verification.approved`, `student.verification.revoked`,
 * `skill.verifier.suspended`, `wallet.payout_destination.changed`. Kept as a validated string
 * rather than an enum so a module can be audited without a contracts release; the ingest layer
 * still rejects unknown events (ADR-034 §3).
 */
export const auditActionCodeSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+$/, 'must be a dotted lowercase identifier');

/**
 * What the action was performed *on*. Also an open set, for the same reason as `action`:
 * `verification`, `evidence_request`, `verifier_account`, `wallet`, `payout_destination`,
 * `booking`, `account`.
 */
export const auditTargetTypeSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z][a-z0-9_]*$/, 'must be a lowercase identifier');

/**
 * A decision-relevant state snapshot.
 *
 * **Whitelisted by construction**: this is a shallow map of scalars, not a blob. NFR-005 and
 * ADR-028 §2 forbid audit rows carrying document contents or personal payloads, so the type
 * cannot express nested objects and the ingest side (ADR-034 §3) admits fields by name. A
 * snapshot that needs a list is a signal the action should be split, not that this should
 * widen.
 */
export const auditStateSchema = z
  .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .nullable();

/**
 * FR-015 / ADR-028 / ADR-034: one audited privileged action, as stored and returned.
 *
 * `id` is the audit row's own id (server-assigned). `sourceEventId` is the domain event that
 * produced it, when there was one — it is what makes ingestion idempotent (ADR-013/ADR-034 §4)
 * and lets an administrator trace a row back to the event stream without a cross-schema join.
 * It is null for rows written directly by an operator action with no event behind it.
 */
export const auditEventSchema = z.object({
  id: z.string().min(1),
  actorId: z.string().min(1).nullable(),
  action: auditActionCodeSchema,
  targetType: auditTargetTypeSchema,
  targetId: z.string().min(1).nullable(),
  oldState: auditStateSchema,
  newState: auditStateSchema,
  occurredAt: z.string().datetime({ offset: true }),
  traceId: z.string().min(1).nullable(),
  metadata: auditStateSchema,
  /** The originating domain event id (ADR-013), or null when written without one. */
  sourceEventId: z.string().min(1).nullable(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

/**
 * FR-015: query params for `GET /audit-log`.
 *
 * Filters are the three FR-015 names — actor, time, action type — plus target and a free-text
 * `q` over target id. `from`/`to` are inclusive bounds on `occurredAt`. `sort` is whitelisted
 * to the two orders the `(occurred_at, id)` index serves.
 */
export const auditLogQuerySchema = paginationQuerySchema.extend({
  actorId: z.string().min(1).optional(),
  action: auditActionCodeSchema.optional(),
  targetType: auditTargetTypeSchema.optional(),
  targetId: z.string().min(1).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  q: z.string().min(2).max(120).optional(),
  sort: z.enum(['occurredAt', '-occurredAt']).optional(),
});
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

/** FR-015: a page of the admin audit log. */
export const auditLogPageSchema = pagedSchema(auditEventSchema);
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;

/**
 * FR-015: the operations dashboard.
 *
 * An **aggregate**, not a list: an Administrator lands here to see how much work is waiting and
 * where, then goes to the queue that owns it. Every count is a count of rows the corresponding
 * module already owns — nothing here is derived, estimated or cached, so a figure on this screen
 * and the queue it points at cannot disagree.
 *
 * `byDomain` is keyed by taxonomy category and only contains categories with live queue work;
 * a domain with nothing waiting is absent rather than a zero row.
 */
export const verificationCountsSchema = z.object({
  pending: z.number().int().min(0),
  approved: z.number().int().min(0),
  rejected: z.number().int().min(0),
  revoked: z.number().int().min(0),
});

export const evidenceCountsSchema = z.object({
  pending: z.number().int().min(0),
  claimed: z.number().int().min(0),
  approved: z.number().int().min(0),
  rejected: z.number().int().min(0),
  superseded: z.number().int().min(0),
});

export const adminDashboardSchema = z.object({
  /** FR-002/FR-019 verifications by status, counted by the student-verification module. */
  verifications: verificationCountsSchema,
  /** FR-003/FR-004 evidence by status, counted by the skill-verification module. */
  evidence: evidenceCountsSchema,
  /** Live queue depth per domain (`pending` + `claimed`), keyed by taxonomy category. */
  evidenceByDomain: z.record(z.number().int().min(0)),
  /** The most recent audited actions, newest first — the same rows `GET /audit-log` returns. */
  recentAuditEvents: z.array(auditEventSchema),
  /**
   * FR-015 / OQ-015 / ADR-037: suspended accounts, counted by account-profile.
   *
   * Live-read like every other figure here (ADR-034 §7) and, crucially, derived from the same read
   * the lock list uses — so the count and the list it points at cannot disagree.
   */
  suspendedAccounts: z.object({ total: z.number().int().min(0) }),
  /** When the aggregate was assembled, so a client can show its freshness. */
  generatedAt: z.string().datetime({ offset: true }),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
