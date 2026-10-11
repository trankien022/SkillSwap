import { z } from 'zod';

export * from './envelope';
export * from './pagination';

export const identityHeadersSchema = z.object({
  'x-user-id': z.string().min(1).optional(),
  'x-user-email': z.string().email().optional(),
  'x-user-role': z.string().min(1).optional(),
});

export const advanceStatusSchema = z.object({
  toState: z.string().min(1),
});
export type AdvanceStatusInput = z.infer<typeof advanceStatusSchema>;

export const moduleStatusSchema = z.object({
  module: z.string().min(1),
  state: z.string().min(1),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
});
export type ModuleStatusView = z.infer<typeof moduleStatusSchema>;

export const advanceStatusResultSchema = z.object({
  previousState: z.string().min(1),
  newState: z.string().min(1),
});
export type AdvanceStatusResult = z.infer<typeof advanceStatusResultSchema>;

export const eventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  payload: z.unknown(),
});
export type EventEnvelope<TPayload = unknown> = z.infer<typeof eventEnvelopeSchema> & {
  payload: TPayload;
};

export const bookingConfirmedSchema = z.object({
  bookingId: z.string().min(1),
  studentId: z.string().min(1),
  teacherId: z.string().min(1),
  amountCredits: z.number().int().positive(),
});
export type BookingConfirmed = z.infer<typeof bookingConfirmedSchema>;

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

/** FR-020 / ADR-021: a completed class releases the teacher's pending income. */
export const classCompletedSchema = z.object({
  classId: z.string().min(1),
  teacherId: z.string().min(1),
  basis: z.enum(['scheduled_end', 'teacher_ended']),
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

/** FR-007 / API-005: book a class. `created` is false on an idempotent replay. */
export const bookClassResultSchema = z.object({
  booking: bookingSchema,
  created: z.boolean(),
});
export type BookClassResultView = z.infer<typeof bookClassResultSchema>;

/** FR-009 / API-006: confirm a pending booking. `booking` is null when nothing was pending. */
export const confirmBookingResultSchema = z.object({
  confirmed: z.boolean(),
  booking: bookingSchema.nullable(),
});
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

/** FR-020 / ADR-021: complete a class; `basis` is the completion reason, null when not completed. */
export const completeClassResultSchema = z.object({
  completed: z.boolean(),
  basis: z.string().min(1).nullable(),
});
export type CompleteClassResultView = z.infer<typeof completeClassResultSchema>;

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

/** FR-008: wallet top-up and callback (ADR-017). Amounts are integer VND. */
export const topUpRequestSchema = z.object({
  amountVnd: z.number().int().positive().max(100_000_000),
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

export const topUpCallbackSchema = z.object({
  providerRef: z.string().min(1),
  amountVnd: z.number().int().positive(),
  status: z.enum(['settled', 'failed', 'reversed']),
});
export type TopUpCallbackInput = z.infer<typeof topUpCallbackSchema>;

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

export const walletHistoryPageSchema = z.object({
  items: z.array(walletHistoryItemSchema),
  nextCursor: z.string().min(1).nullable(),
});
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
export const verificationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'revoked']);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const submitStudentVerificationSchema = z.object({
  schoolName: z.string().min(1).max(200),
  major: z.string().min(1).max(120).optional(),
  documentId: z.string().min(1).max(100),
});
export type SubmitStudentVerificationInput = z.infer<typeof submitStudentVerificationSchema>;

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

export const verificationDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().min(1).max(500).optional(),
    approvedMajor: z.string().min(1).max(120).optional(),
  })
  .refine((value) => value.decision !== 'reject' || (value.reason?.trim().length ?? 0) > 0, {
    message: 'A rejection requires a reason',
    path: ['reason'],
  });
export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;

/** FR-019 / ADR-025: revoke a verification (admin only, reason required). */
export const verificationRevocationSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type VerificationRevocationInput = z.infer<typeof verificationRevocationSchema>;

export const studentVerificationSchema = z.object({
  id: z.string().min(1),
  status: verificationStatusSchema,
  schoolName: z.string().min(1),
  major: z.string().min(1).nullable(),
  reviewerId: z.string().min(1).nullable(),
  reason: z.string().min(1).nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  submittedAt: z.string().datetime({ offset: true }),
});
export type StudentVerificationView = z.infer<typeof studentVerificationSchema>;

export const studentVerificationEventSchema = z.object({
  verificationId: z.string().min(1),
  accountId: z.string().min(1),
  status: verificationStatusSchema,
  schoolName: z.string().min(1),
  reason: z.string().min(1).nullable(),
  occurredAt: z.string().datetime({ offset: true }),
});
export type StudentVerificationEvent = z.infer<typeof studentVerificationEventSchema>;

/** FR-003 / ADR-026: skill taxonomy, evidence types and the fixed ordered level scale. */
export const skillLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);
export type SkillLevel = z.infer<typeof skillLevelSchema>;

export const evidenceTypeSchema = z.enum(['certificate', 'verifier_assessment']);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const evidenceStatusSchema = z.enum(['pending', 'claimed', 'approved', 'rejected', 'superseded']);
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

/** FR-003: a catalogue entry in the two-level `category → skill` tree (ADR-026 §1–2). */
export const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
});
export type SkillView = z.infer<typeof skillSchema>;

/** FR-003 / ADR-026 §5: the effective approved level cache; null until approved. */
export const profileSkillSchema = z.object({
  id: z.string().min(1),
  skillId: z.string().min(1),
  skillName: z.string().min(1),
  category: z.string().min(1),
  approvedLevel: skillLevelSchema.nullable(),
});
export type ProfileSkillView = z.infer<typeof profileSkillSchema>;

/** FR-003 / API-002: submit skill evidence for a known skill at a requested level. */
export const submitSkillEvidenceSchema = z.object({
  skillId: z.string().min(1),
  requestedLevel: skillLevelSchema,
  evidenceType: evidenceTypeSchema,
  documentRef: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(1000).optional(),
});
export type SubmitSkillEvidenceInput = z.infer<typeof submitSkillEvidenceSchema>;

/** FR-003: the owner-facing view of one evidence version. */
export const skillEvidenceViewSchema = z.object({
  id: z.string().min(1),
  profileSkillId: z.string().min(1),
  skillId: z.string().min(1),
  skillName: z.string().min(1).nullable(),
  category: z.string().min(1).nullable(),
  ownerId: z.string().min(1).nullable(),
  version: z.number().int().positive(),
  evidenceType: evidenceTypeSchema,
  documentRef: z.string().min(1).nullable(),
  description: z.string().min(1).nullable(),
  requestedLevel: skillLevelSchema,
  approvedLevel: skillLevelSchema.nullable(),
  status: evidenceStatusSchema,
  claimedBy: z.string().min(1).nullable(),
  claimedAt: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().min(1).nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  submittedAt: z.string().datetime({ offset: true }),
});
export type SkillEvidenceView = z.infer<typeof skillEvidenceViewSchema>;

/** FR-003 / ADR-013: emitted in the same transaction as the evidence write. */
export const skillEvidenceEventSchema = z.object({
  evidenceId: z.string().min(1),
  profileSkillId: z.string().min(1),
  accountId: z.string().min(1),
  skillId: z.string().min(1),
  version: z.number().int().positive(),
  requestedLevel: skillLevelSchema,
  status: evidenceStatusSchema,
  // Set on a decision: the effective level granted (null unless approved) and the reason on rejection.
  approvedLevel: skillLevelSchema.nullable().optional(),
  reason: z.string().min(1).nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }),
});
export type SkillEvidenceEvent = z.infer<typeof skillEvidenceEventSchema>;

/** FR-004 / ADR-027: a Verifier account with a seeded expertise set. */
export const verifierStatusSchema = z.enum(['active', 'suspended', 'revoked']);
export type VerifierStatus = z.infer<typeof verifierStatusSchema>;

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
 * FR-018 / ADR-028: the reusable audit event contract (matches SRS `AuditEvent`).
 * Append-only; snapshots are whitelisted and never carry document contents (NFR-005).
 */
export const auditActionSchema = z.enum(['submitted', 'claimed', 'approved', 'rejected', 'superseded']);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditEventSchema = z.object({
  id: z.string().min(1),
  evidenceId: z.string().min(1),
  version: z.number().int().positive(),
  action: auditActionSchema,
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
export type AuditEventView = z.infer<typeof auditEventSchema>;

/** FR-018: one evidence version and its ordered audit entries. */
export const evidenceVersionHistorySchema = z.object({
  version: z.number().int().positive(),
  evidenceId: z.string().min(1),
  currentStatus: evidenceStatusSchema,
  requestedLevel: skillLevelSchema,
  approvedLevel: skillLevelSchema.nullable(),
  submittedAt: z.string().datetime({ offset: true }),
  entries: z.array(auditEventSchema),
});
export type EvidenceVersionHistoryView = z.infer<typeof evidenceVersionHistorySchema>;

/** FR-018 / API: the full decision history of a profile-skill's evidence. */
export const skillEvidenceHistorySchema = z.object({
  profileSkillId: z.string().min(1),
  skillId: z.string().min(1),
  versions: z.array(evidenceVersionHistorySchema),
});
export type SkillEvidenceHistoryView = z.infer<typeof skillEvidenceHistorySchema>;
