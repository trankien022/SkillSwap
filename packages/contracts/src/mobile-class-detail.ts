import { z } from 'zod';
import { classLifecycleStateSchema, type ClassLifecycleState } from './mobile-classes';

/**
 * 5 domain lifecycle states of a Booking (FR-007, FR-009, FR-011).
 */
export const bookingStateSchema = z.enum([
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'disputed',
]);
export type BookingState = z.infer<typeof bookingStateSchema>;

export const classIdParamSchema = z.string().uuid();

export const classDetailParamsSchema = z.object({
  id: classIdParamSchema,
});
export type ClassDetailParams = z.infer<typeof classDetailParamsSchema>;

export const classDetailTeacherSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  averageRating: z.number().min(0).max(5).nullable(),
  ratingsCount: z.number().int().nonnegative(),
});
export type ClassDetailTeacherView = z.infer<typeof classDetailTeacherSchema>;

export const classDetailRatingItemSchema = z.object({
  id: z.string().min(1),
  learnerDisplayName: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  comment: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
});
export type ClassDetailRatingItemView = z.infer<typeof classDetailRatingItemSchema>;

export const ownBookingSummarySchema = z.object({
  bookingId: z.string().min(1),
  state: bookingStateSchema,
  expiresAt: z.string().datetime({ offset: true }).nullable(),
});
export type OwnBookingSummaryView = z.infer<typeof ownBookingSummarySchema>;

/**
 * Route 14 / FR-005, FR-006, FR-007: detailed class view.
 * Includes public teacher summary, seat availability, canBook calculation,
 * provisional rating fields, and optional own-booking status for the authenticated caller.
 */
export const classDetailViewSchema = z.object({
  id: z.string().min(1),
  teacher: classDetailTeacherSchema,
  skillIds: z.array(z.string().min(1)),
  description: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int(),
  priceCredits: z.number().int().positive(),
  capacity: z.number().int().positive(),
  availableSeats: z.number().int().nonnegative(),
  state: classLifecycleStateSchema,
  canBook: z.boolean(),
  recentRatings: z.array(classDetailRatingItemSchema),
  ownBooking: ownBookingSummarySchema.nullable().optional(),
});
export type ClassDetailView = z.infer<typeof classDetailViewSchema>;
export { type ClassLifecycleState };
