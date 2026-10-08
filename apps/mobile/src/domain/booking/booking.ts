/**
 * Booking domain for the mobile client (FR-007).
 *
 * These types mirror the API-004 / API-005 response shapes (class and booking
 * views). They are declared locally because the shared `@skillswap/contracts`
 * does not export them on `main` yet; once the FR-007 contracts land, these can
 * be replaced by re-exports from `@skillswap/contracts` without changing the UI.
 */

export interface ClassView {
  id: string;
  teacherId: string;
  state: string;
  startsAt: string;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

export interface BookingView {
  bookingId: string;
  classId: string;
  learnerId: string;
  state: string;
  priceCredits: number;
  createdAt: string;
}

/** Mirrors apps/api live-class domain/booking.ts BOOKING_REJECTION_REASONS. */
export const BOOKING_REJECTION_REASONS = [
  'class_not_bookable',
  'class_started',
  'booking_window_closed',
  'class_full',
  'duplicate_booking',
  'self_booking',
  'invalid_duration',
] as const;

export type BookingRejectionReason = (typeof BOOKING_REJECTION_REASONS)[number];

/** The `{ booking, created }` envelope returned by API-005. */
export interface BookClassResult {
  booking: BookingView;
  created: boolean;
}

/** A failed booking, carrying the backend reason for the UI to translate. */
export class BookingError extends Error {
  constructor(
    readonly reason: BookingRejectionReason,
    message: string,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}
