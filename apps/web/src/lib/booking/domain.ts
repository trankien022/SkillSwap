/**
 * Web booking layer (FR-007).
 *
 * The seam between the UI and the data source. Types come from the shared
 * `@skillswap/contracts` (the API-004 / API-005 shapes); the mock gateway
 * implements this port today and a real HTTP adapter can replace it later.
 */

export type { ClassView, BookingView, BookingRequestInput } from '@skillswap/contracts';

import type { BookingView, ClassView } from '@skillswap/contracts';

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

/**
 * Re-exported so the UI models a booking against one source of truth: the
 * confirm answer and the caller's own hold come from the same contracts as the
 * booking call itself.
 */
export type { ConfirmBookingResponse, OwnBookingSummaryView } from '@skillswap/contracts';

import type { ConfirmBookingResponse, OwnBookingSummaryView } from '@skillswap/contracts';

/** Port the UI depends on. */
export interface BookingGateway {
  getClass(classId: string): Promise<ClassView>;
  bookClass(classId: string, idempotencyKey: string): Promise<BookClassResult>;
  /**
   * Confirm the hold into a paid booking (FR-007). The answer is deliberately
   * not trusted on its own: `confirmed` can be `false` by design while the
   * debit is still settling, so callers resolve it against `getOwnBooking`.
   */
  confirmBooking(bookingId: string): Promise<ConfirmBookingResponse>;
  /**
   * The caller's hold on a class, or null when they have none — the read that
   * tells a learner "you already hold a seat" instead of letting a second book
   * attempt collide with the first.
   */
  getOwnBooking(classId: string): Promise<OwnBookingSummaryView | null>;
}
