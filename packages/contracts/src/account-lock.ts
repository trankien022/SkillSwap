import { z } from 'zod';
import { actorIdSchema } from './audit-actor';
import { pagedSchema, paginationQuerySchema } from './pagination';

/**
 * FR-015 / OQ-015 / ADR-037: an Administrator suspends an account.
 *
 * A reason is **required**. ADR-037 decision 2: a suspension without one cannot be told apart from
 * a bug, and the Administrator who applied it could not be held to account for it. The bound (500)
 * matches the other administrative reason fields so the audit snapshot stays a whitelisted scalar
 * rather than a document (NFR-005).
 */
export const suspendAccountSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type SuspendAccountInput = z.infer<typeof suspendAccountSchema>;

/**
 * FR-015 / ADR-013 / ADR-035: emitted in the same transaction as the status write.
 *
 * Two account ids, deliberately distinct and easy to confuse:
 * - `accountId` is the **account whose status changed** (the subject);
 * - `actorId` is the **Administrator who changed it**.
 *
 * The old→new pair is carried because that is what the audit row has to show, and deriving it
 * later would mean reading a row that has already moved on.
 */
export const accountStatusChangedSchema = z
  .object({
    accountId: z.string().uuid(),
    status: z.enum(['active', 'suspended']),
    previousStatus: z.enum(['active', 'suspended']),
    /** Present exactly when `status === 'suspended'` (ADR-037 decision 1). */
    reason: z.string().min(1).max(500).nullable(),
    occurredAt: z.string().datetime({ offset: true }),
    actorId: actorIdSchema,
  })
  .superRefine((value, ctx) => {
    // The database enforces this too, but a payload that reaches a consumer should never describe
    // a state the schema forbids: "suspended with no reason" is the case ADR-037 refuses.
    if (value.status === 'suspended' && value.reason === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A suspension requires a reason',
      });
    }
    if (value.status === 'active' && value.reason !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A reactivated account carries no suspension reason',
      });
    }
  });
export type AccountStatusChangedEvent = z.infer<typeof accountStatusChangedSchema>;

/** FR-015 / ADR-037 phase 3: one row of the account-lock list. */
export const suspendedAccountSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.string().min(1),
  reason: z.string().min(1),
  suspendedBy: z.string().uuid().nullable(),
  suspendedAt: z.string().datetime({ offset: true }),
});
export type SuspendedAccountView = z.infer<typeof suspendedAccountSchema>;

/**
 * FR-015 / NFR-014: query for the account-lock list.
 *
 * The plan wrote `?status=suspended`; here it is a **closed enum with one value** rather than a free
 * string. The endpoint only ever lists suspensions, so accepting `status=active` would be a filter
 * that silently returns nothing — and a client would read that emptiness as "no locked accounts".
 * `suspended` is the only value the route answers, so naming it explicitly is honest and anything
 * else is rejected.
 */
export const suspendedAccountsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['suspended']).optional(),
});
export type SuspendedAccountsQueryInput = z.infer<typeof suspendedAccountsQuerySchema>;

/**
 * FR-015 / ADR-037: what a lock or release answers.
 *
 * `changed` is reported rather than inferred from `status`, because ADR-037 makes a second suspend
 * of an already-suspended account a no-op that emits **no** audit row — a client that assumed every
 * 200 meant "this act just happened" would narrate an act that did not.
 */
export const accountLockResultSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(['active', 'suspended']),
  changed: z.boolean(),
  /** Present exactly when `status === 'suspended'`, matching `suspendAccountSchema`. */
  reason: z.string().min(1).max(500).nullable(),
});
export type AccountLockResult = z.infer<typeof accountLockResultSchema>;

/** FR-015 / ADR-034 §7: a live-read page, uncached like the rest of the dashboard. */
export const suspendedAccountsPageSchema = pagedSchema(suspendedAccountSchema);
export type SuspendedAccountsPage = z.infer<typeof suspendedAccountsPageSchema>;
