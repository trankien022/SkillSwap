import { z } from 'zod';

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

/** FR-001: local accounts, sign-in and session lifecycle (ADR-016). */
export const accountRoleSchema = z.enum(['learner', 'teacher', 'admin']);
export type AccountRole = z.infer<typeof accountRoleSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  role: accountRoleSchema.default('learner'),
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

export const meResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: accountRoleSchema,
  status: z.string().min(1),
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
