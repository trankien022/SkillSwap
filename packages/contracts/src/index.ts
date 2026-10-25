import { z } from 'zod';

export * from './envelope';
export * from './pagination';
export * from './skill-evidence';
export * from './verification';

import { pagedSchema, paginationQuerySchema } from './pagination';
import {
  evidenceStatusSchema,
  evidenceTypeSchema,
  skillEvidenceViewSchema,
  skillLevelSchema,
} from './skill-evidence';

export const identityHeadersSchema = z.object({
  'x-user-id': z.string().min(1).optional(),
  'x-user-email': z.string().email().optional(),
  'x-user-role': z.string().min(1).optional(),
});

export const eventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  payload: z.unknown(),
});
export type EventEnvelope<TPayload = unknown> = z.infer<typeof eventEnvelopeSchema> & {
  payload: TPayload;
};

export * from './booking-payment-events';

/** FR-007 / ADR-019: a cancelled booking that the wallet may need to refund. */
export const bookingCancelledSchema = z.object({
  bookingId: z.string().min(1),
  classId: z.string().min(1),
  learnerId: z.string().min(1),
  teacherId: z.string().min(1),
  priceCredits: z.number().int().positive(),
  reason: z.enum(['expired', 'class_cancelled', 'teacher_no_show']),
});
export type BookingCancelled = z.infer<typeof bookingCancelledSchema>;

/**
 * FR-020 / ADR-021: how a class completed.
 *
 * `scheduled_end` — the scheduled end passed. `room_idle` — everyone left the room and
 * stayed away past the grace period (AC-035). Both are published, because the wallet's
 * release does not depend on which one happened, and a consumer that rejected `room_idle`
 * would dead-letter a legitimate payout and leave the Teacher's income in pending.
 */
export const classCompletedSchema = z.object({
  classId: z.string().min(1),
  teacherId: z.string().min(1),
  basis: z.enum(['scheduled_end', 'room_idle']),
  completedAt: z.string().datetime({ offset: true }),
  bookings: z.array(
    z.object({
      bookingId: z.string().min(1),
      learnerId: z.string().min(1),
      priceCredits: z.number().int().positive(),
    }),
  ),
});
export type ClassCompleted = z.infer<typeof classCompletedSchema>;

export const statusChangedSchema = z.object({
  module: z.string().min(1),
  previousState: z.string().min(1),
  newState: z.string().min(1),
  changedBy: z.string().min(1),
  changedAt: z.string().datetime({ offset: true }),
});
export type StatusChanged = z.infer<typeof statusChangedSchema>;

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string().min(1),
  error: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** FR-005 / API-004: create and publish a class. */
export const createClassSchema = z.object({
  skillIds: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(30).max(180),
  priceCredits: z.number().int().positive(),
  capacity: z.number().int().positive(),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const classSchema = z.object({
  id: z.string().min(1),
  teacherId: z.string().min(1),
  state: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int(),
  priceCredits: z.number().int(),
  capacity: z.number().int(),
});
export type ClassView = z.infer<typeof classSchema>;

/** FR-007 / AC-017: edit a class before its first confirmed booking locks it. */
export const updateClassSchema = z
  .object({
    skillIds: z.array(z.string().min(1)).min(1).optional(),
    description: z.string().min(1).optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    durationMinutes: z.number().int().min(30).max(180).optional(),
    priceCredits: z.number().int().positive().optional(),
    capacity: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

/** FR-007 / API-005: book a class. The idempotency key makes retries safe. */
export const bookingRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
});
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const bookingSchema = z.object({
  bookingId: z.string().min(1),
  classId: z.string().min(1),
  learnerId: z.string().min(1),
  state: z.string().min(1),
  priceCredits: z.number().int(),
  createdAt: z.string().datetime({ offset: true }),
});
export type BookingView = z.infer<typeof bookingSchema>;

/** Existing API-005/API-006 response names retained for mobile adapters. */
export const bookClassResponseSchema = z.object({
  booking: bookingSchema,
  created: z.boolean(),
});
export type BookClassResponse = z.infer<typeof bookClassResponseSchema>;
export const confirmBookingResponseSchema = z.object({
  confirmed: z.boolean(),
  booking: bookingSchema.nullable(),
});
export type ConfirmBookingResponse = z.infer<typeof confirmBookingResponseSchema>;

/** FR-007 / API-005: book a class. `created` is false on an idempotent replay. */
export const bookClassResultSchema = bookClassResponseSchema;
export type BookClassResultView = z.infer<typeof bookClassResultSchema>;

/** FR-009 / API-006: confirm a pending booking. `booking` is null when nothing was pending. */
export const confirmBookingResultSchema = confirmBookingResponseSchema;
export type ConfirmBookingResultView = z.infer<typeof confirmBookingResultSchema>;

/** FR-007 / AC-022: cancel a class and refund affected learners. */
export const cancelClassResultSchema = z.object({
  classCancelled: z.boolean(),
  bookingsCancelled: z.number().int().min(0),
});
export type CancelClassResultView = z.infer<typeof cancelClassResultSchema>;

/** FR-007 / AC-024: mark a teacher no-show for a booking. */
export const markTeacherNoShowResultSchema = z.object({
  cancelled: z.boolean(),
});
export type MarkTeacherNoShowResultView = z.infer<typeof markTeacherNoShowResultSchema>;

/** FR-020 / ADR-021: start a class the teacher is holding. */
export const startClassResultSchema = z.object({
  started: z.boolean(),
});
export type StartClassResultView = z.infer<typeof startClassResultSchema>;

/** FR-020 / ADR-021 Amendment A: the teacher-initiated completion result was removed with the route. */
export type CompleteClassResultView = never;

/** FR-001 / ADR-030: an account has exactly one access role. Learner/Teacher are capabilities, not roles. */
export const accountRoleSchema = z.enum(['user', 'verifier', 'admin']);
export type AccountRole = z.infer<typeof accountRoleSchema>;

/**
 * FR-001 / ADR-030: the only role a public user may create at registration. Verifier
 * and Administrator accounts are provisioned out of band, never self-registered.
 */
export const selfRegistrationRoleSchema = z.enum(['user']);
export type SelfRegistrationRole = z.infer<typeof selfRegistrationRoleSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  role: selfRegistrationRoleSchema.default('user'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequestInput = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutRequestInput = z.infer<typeof logoutRequestSchema>;

export const tokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal('Bearer'),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

/** FR-017 (ADR-024): the account's trust summary, projected from verification events. */
export const accountVerificationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'revoked']);
export type AccountVerificationStatus = z.infer<typeof accountVerificationStatusSchema>;

export const studentVerificationSummarySchema = z.object({
  status: accountVerificationStatusSchema,
  reason: z.string().min(1).nullable(),
});
export type StudentVerificationSummary = z.infer<typeof studentVerificationSummarySchema>;

export const meResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: accountRoleSchema,
  status: z.string().min(1),
  // FR-017: null when the account never submitted a student verification.
  studentVerification: studentVerificationSummarySchema.nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** FR-008: wallet top-up and callback (ADR-033). Amounts are integer VND. */
export const topUpRequestSchema = z.object({
  amountVnd: z.number().int().positive().max(100_000_000),
  /**
   * FR-008: where the payer's client should be sent back after paying.
   *
   * Optional. Omitted → the configured `SEPAY_RETURN_URL`. When present the
   * API accepts it only if its origin is on the allow-list — the configured
   * return URL's origin plus the origins in `SEPAY_RETURN_URL_ALLOWED_ORIGINS`
   * — or it uses the mobile client's `skillswap:` scheme; anything else is
   * refused rather than silently rewritten. The URL only ever ends up in
   * SePay's `success_url`/`error_url`/`cancel_url`, and settlement is decided
   * by the server-to-server IPN, never by this redirect.
   */
  returnUrl: z.string().min(1).optional(),
});
export type TopUpRequestInput = z.infer<typeof topUpRequestSchema>;

export const topUpIntentSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  provider: z.string().min(1),
  providerRef: z.string().min(1),
  amountVnd: z.number().int().positive(),
  amountCredits: z.number().int().positive(),
  status: z.string().min(1),
  paymentUrl: z.string().min(1).optional(),
});
export type TopUpIntentView = z.infer<typeof topUpIntentSchema>;

/**
 * FR-008 / ADR-033: the pending intent as returned by `POST /wallet/top-ups`.
 *
 * `paymentUrl` is required here. It is the SePay hosted checkout returned by that
 * call, and it is *not* persisted, so only this endpoint can supply it.
 */
export const topUpIntentCreatedSchema = topUpIntentSchema.extend({
  paymentUrl: z.string().min(1),
});
export type TopUpIntentCreated = z.infer<typeof topUpIntentCreatedSchema>;

/**
 * FR-008 / ADR-033: the poll result for `GET /wallet/top-ups/:id`.
 *
 * Deliberately has **no** `paymentUrl`: the checkout URL carries a SePay-signed
 * token we cannot re-derive without re-submitting the form, so re-issuing one
 * here would be a lie. The client already holds the URL from creation; this
 * endpoint only answers "has it settled yet?". `settledAt`/`paidAmountVnd` are
 * the provider's own settlement facts, present once an IPN has been applied.
 */
export const topUpIntentStatusSchema = topUpIntentSchema
  .omit({ paymentUrl: true })
  .extend({
    paidAmountVnd: z.number().int().nullable(),
    paidAt: z.string().nullable(),
  });
export type TopUpIntentStatusView = z.infer<typeof topUpIntentStatusSchema>;

/**
 * FR-008 / ADR-033: the SePay Payment Gateway IPN payload.
 *
 * Built from real Sandbox deliveries (plan §5a), not the doc sample. SePay is
 * inconsistent on two points the schema must tolerate:
 *  - a successful payment arrives as `ORDER_PAID` or `PAYMENT_SUCCESS`;
 *  - `order_amount` / `transaction_amount` are strings in one delivery and
 *    numbers in another.
 * `customer` and `agreement` may be null; `custom_data` is an array or object.
 */
export const sepayIpnSchema = z.object({
  timestamp: z.number().int().optional(),
  notification_type: z.string().min(1),
  order: z.object({
    id: z.string().optional(),
    order_id: z.string().optional(),
    order_status: z.string().optional(),
    order_currency: z.string().optional(),
    order_amount: z.union([z.string(), z.number()]),
    order_invoice_number: z.string().min(1),
    order_description: z.string().optional(),
    custom_data: z.unknown().optional(),
  }),
  transaction: z
    .object({
      id: z.string().optional(),
      payment_method: z.string().optional(),
      transaction_id: z.string().optional(),
      transaction_type: z.string().optional(),
      transaction_date: z.string().optional(),
      transaction_status: z.string().optional(),
      transaction_amount: z.union([z.string(), z.number()]).optional(),
      transaction_currency: z.string().optional(),
    })
    .optional(),
  customer: z.unknown().nullable().optional(),
  agreement: z.unknown().nullable().optional(),
});
export type SepayIpn = z.infer<typeof sepayIpnSchema>;

/** FR-008 / ADR-033: the acknowledgement SePay expects (HTTP 200, this body). */
export const sepayIpnAckSchema = z.object({ success: z.literal(true) });
export type SepayIpnAck = z.infer<typeof sepayIpnAckSchema>;

export const walletBalanceSchema = z.object({
  availableCredits: z.number().int(),
  pendingCredits: z.number().int(),
});
export type WalletBalanceView = z.infer<typeof walletBalanceSchema>;

/** FR-010: paginated wallet history (ADR-022). */
export const walletHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
});
export type WalletHistoryQueryInput = z.infer<typeof walletHistoryQuerySchema>;

export const walletHistoryItemSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  direction: z.enum(['credit', 'debit']),
  amountCredits: z.number().int().positive(),
  status: z.enum(['completed', 'reversed']),
  reference: z.string().min(1).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type WalletHistoryItemView = z.infer<typeof walletHistoryItemSchema>;

/** FR-010 / NFR-014 (ADR-022): a page of wallet history with page metadata. */
export const walletHistoryPageSchema = pagedSchema(walletHistoryItemSchema);
export type WalletHistoryPage = z.infer<typeof walletHistoryPageSchema>;

/** FR-011: join an online class room (ADR-020). */
export const roomAccessRequestSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
});
export type RoomAccessRequestInput = z.infer<typeof roomAccessRequestSchema>;

export const roomAccessResponseSchema = z.object({
  room: z.string().min(1),
  token: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }),
  url: z.string().min(1),
});
export type RoomAccessResponse = z.infer<typeof roomAccessResponseSchema>;

/** FR-002: student verification (ADR-023). At most one effective per account; no expiry. */

/** FR-002 / ADR-023: request a pre-signed upload target for a document. */
export const documentUploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});
export type DocumentUploadRequestInput = z.infer<typeof documentUploadRequestSchema>;

export const documentUploadTargetSchema = z.object({
  documentId: z.string().min(1),
  uploadUrl: z.string().min(1),
  objectKey: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }),
});
export type DocumentUploadTargetView = z.infer<typeof documentUploadTargetSchema>;

/** FR-003 / ADR-026: skill taxonomy, evidence types and the fixed ordered level scale. */

/** FR-004 / ADR-027: a Verifier account with a seeded expertise set. */
export const verifierStatusSchema = z.enum(['active', 'suspended', 'revoked']);
export type VerifierStatus = z.infer<typeof verifierStatusSchema>;

/** FR-004 / NFR-014: query params for GET /verifiers/me/queue. */
export const verifierQueueQuerySchema = paginationQuerySchema.extend({
  level: skillLevelSchema.optional(),
  type: evidenceTypeSchema.optional(),
  // Skill-name free-text search.
  q: z.string().min(1).optional(),
  // 'submittedAt' (oldest first, FIFO) or '-submittedAt' (newest first).
  sort: z.enum(['submittedAt', '-submittedAt']).optional(),
});
export type VerifierQueueQueryInput = z.infer<typeof verifierQueueQuerySchema>;

/** FR-004 / NFR-014: a page of the Verifier's expertise-scoped pending queue. */
export const verifierQueuePageSchema = pagedSchema(skillEvidenceViewSchema);
export type VerifierQueuePage = z.infer<typeof verifierQueuePageSchema>;

export const verifierSchema = z.object({
  accountId: z.string().min(1),
  status: verifierStatusSchema,
  expertise: z.array(z.string().min(1)),
});
export type VerifierView = z.infer<typeof verifierSchema>;

/** FR-004: an administrator changes a Verifier's lifecycle status. */
export const verifierStatusChangeSchema = z.object({
  status: z.enum(['active', 'suspended', 'revoked']),
});
export type VerifierStatusChangeInput = z.infer<typeof verifierStatusChangeSchema>;

/**
 * FR-004 / FR-015 / ADR-013: emitted in the same transaction as a Verifier status change.
 *
 * FR-015's audit log consumes this: suspending or revoking a Verifier is a privileged action and
 * is exactly the kind of event an administrator must be able to reconstruct afterwards. The
 * `previousStatus` is carried so the audit row can show old→new without a second read.
 */
export const verifierStatusChangedSchema = z.object({
  verifierId: z.string().min(1),
  status: verifierStatusSchema,
  previousStatus: verifierStatusSchema,
  occurredAt: z.string().datetime({ offset: true }),
});
export type VerifierStatusChangedEvent = z.infer<typeof verifierStatusChangedSchema>;

/** FR-004 / API-003: approve or reject a claimed evidence request. */
export const skillEvidenceDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    approvedLevel: skillLevelSchema.optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .refine((value) => value.decision !== 'reject' || (value.reason?.trim().length ?? 0) > 0, {
    message: 'A rejection requires a reason',
    path: ['reason'],
  });
export type SkillEvidenceDecisionInput = z.infer<typeof skillEvidenceDecisionSchema>;

/**
 * FR-018 / ADR-028: the **evidence** audit entry — one lifecycle step of one evidence
 * version, as returned inside `skillEvidenceHistorySchema`.
 *
 * This is deliberately **not** the general SRS `AuditEvent` row. ADR-028 §4 originally
 * promised a single reusable `auditEventSchema` covering the SRS shape
 * (`actor_id, action, target_type, target_id, old_state_json, new_state_json, …`), but
 * what FR-018 shipped is evidence-scoped: it is keyed by `evidenceId`/`version` and its
 * `action` is the closed evidence lifecycle (`submitted`…`superseded`). ADR-034 §1
 * records that divergence and resolves it by giving the two shapes distinct names. The
 * general row is `auditEventSchema` in `./audit-event.ts`, which FR-015 owns.
 *
 * Append-only; snapshots are whitelisted and never carry document contents (NFR-005).
 */
export const evidenceAuditActionSchema = z.enum(['submitted', 'claimed', 'approved', 'rejected', 'superseded']);
export type EvidenceAuditActionCode = z.infer<typeof evidenceAuditActionSchema>;

export const evidenceAuditEventSchema = z.object({
  id: z.string().min(1),
  evidenceId: z.string().min(1),
  version: z.number().int().positive(),
  action: evidenceAuditActionSchema,
  actorId: z.string().min(1).nullable(),
  fromStatus: evidenceStatusSchema.nullable(),
  toStatus: evidenceStatusSchema,
  reason: z.string().min(1).nullable(),
  snapshot: z.object({
    version: z.number().int().positive(),
    status: evidenceStatusSchema,
    evidenceType: evidenceTypeSchema,
    requestedLevel: skillLevelSchema,
    approvedLevel: skillLevelSchema.nullable(),
    reason: z.string().min(1).nullable(),
  }),
  occurredAt: z.string().datetime({ offset: true }),
  traceId: z.string().min(1).nullable(),
});
export type EvidenceAuditEventView = z.infer<typeof evidenceAuditEventSchema>;

/** FR-018: one evidence version and its ordered audit entries. */
export const evidenceVersionHistorySchema = z.object({
  version: z.number().int().positive(),
  evidenceId: z.string().min(1),
  currentStatus: evidenceStatusSchema,
  requestedLevel: skillLevelSchema,
  approvedLevel: skillLevelSchema.nullable(),
  submittedAt: z.string().datetime({ offset: true }),
  entries: z.array(evidenceAuditEventSchema),
});
export type EvidenceVersionHistoryView = z.infer<typeof evidenceVersionHistorySchema>;

/** FR-018 / API: the full decision history of a profile-skill's evidence. */
export const skillEvidenceHistorySchema = z.object({
  profileSkillId: z.string().min(1),
  skillId: z.string().min(1),
  versions: z.array(evidenceVersionHistorySchema),
});
export type SkillEvidenceHistoryView = z.infer<typeof skillEvidenceHistorySchema>;

export * from './audit-event';
export * from './outbox-dead-letter';
export * from './admin-verifications';
export * from './admin-verifier-queue';
export * from './verification';
export * from './skill-evidence';
export * from './mobile-catalogue';
export * from './mobile-classes';
export * from './mobile-class-detail';
export * from './mobile-my-bookings';
export * from './mobile-ratings';
export * from './mobile-notifications';

