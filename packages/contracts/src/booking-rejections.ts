/** Shared booking rejection vocabulary (FR-007 / AC-034). */
export const BOOKING_REJECTION_REASONS = [
  'class_not_bookable',
  'class_started',
  'booking_window_closed',
  'class_full',
  'duplicate_booking',
  'self_booking',
  'invalid_duration',
  'learner_not_verified',
] as const;

export type BookingRejectionReason = (typeof BOOKING_REJECTION_REASONS)[number];
