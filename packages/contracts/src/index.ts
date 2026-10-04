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
