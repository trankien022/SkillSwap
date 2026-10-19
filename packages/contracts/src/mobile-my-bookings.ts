import { z } from 'zod';
import {
  CLASS_CURSOR_MAX_LENGTH,
  classLifecycleStateSchema,
  decodeClassCursor,
  encodeClassCursor,
  isValidClassCursor,
  type ClassLifecycleState,
} from './mobile-classes';
import { bookingStateSchema, type BookingState } from './mobile-class-detail';
import { MAX_PAGE_LIMIT } from './pagination';

export type BookingCursorTuple = readonly [startsAtISO: string, bookingId: string];

export const encodeBookingCursor = encodeClassCursor as (tuple: BookingCursorTuple) => string;
export const decodeBookingCursor = decodeClassCursor as (cursor: string) => [string, string];
export const isValidBookingCursor = isValidClassCursor;

/**
 * Route 22 / FR-007, FR-009, FR-011, FR-020: query parameters for learner bookings.
 * Owner is strictly bound to currentUserId in controller; no callerId/learnerId query override.
 * Keyset cursor pagination bounded to the shared max page size (100), default 20.
 * Upcoming string transform: 'true' -> true, 'false' -> false, omitted -> undefined (all histories).
 */
export const myBookingsQuerySchema = z.object({
  state: bookingStateSchema.optional(),
  upcoming: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
  cursor: z
    .string()
    .trim()
    .max(CLASS_CURSOR_MAX_LENGTH)
    .refine(isValidBookingCursor, {
      message: 'Invalid booking cursor; must be a canonically encoded base64url JSON tuple [startsAtISO, bookingId]',
    })
    .optional(),
});
export type MyBookingsQueryInput = z.infer<typeof myBookingsQuerySchema>;

export const learnerBookingClassSummarySchema = z.object({
  description: z.string().min(1),
  skillIds: z.array(z.string().min(1)),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int(),
  teacherId: z.string().min(1),
  teacherDisplayName: z.string().min(1),
  classState: classLifecycleStateSchema,
});
export type LearnerBookingClassSummaryView = z.infer<typeof learnerBookingClassSummarySchema>;

/**
 * Route 22: learner booking item with embedded class summary, room access eligibility,
 * and rating eligibility.
 */
export const learnerBookingItemSchema = z.object({
  bookingId: z.string().min(1),
  classId: z.string().min(1),
  state: bookingStateSchema,
  priceCredits: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  classSummary: learnerBookingClassSummarySchema,
  roomAccessEligible: z.boolean(),
  ratingEligible: z.boolean(),
  hasRated: z.boolean(),
});
export type LearnerBookingItemView = z.infer<typeof learnerBookingItemSchema>;

/**
 * Route 22: paginated learner bookings page with exact totalUpcomingCount across all caller
 * confirmed upcoming classes regardless of page filtering or limit.
 */
export const myBookingsPageSchema = z.object({
  items: z.array(learnerBookingItemSchema),
  nextCursor: z.string().nullable(),
  totalUpcomingCount: z.number().int().nonnegative(),
});
export type MyBookingsPageView = z.infer<typeof myBookingsPageSchema>;

export { type BookingState, type ClassLifecycleState };
