/**
 * Booking domain for the mobile client (FR-007).
 *
 * The class and booking view types come from the shared `@skillswap/contracts`
 * package (the API-004 / API-005 shapes), so the client can never drift from
 * the backend. Only the rejection reasons and the error type are local.
 */

export type { ClassView, BookingView, BookingRequestInput } from '@skillswap/contracts';

import type { BookingView } from '@skillswap/contracts';

/** Mirrors apps/api live-class domain/booking.ts BOOKING_REJECTION_REASONS. */
import type { BookingRejectionReason } from '@skillswap/contracts';
export { BOOKING_REJECTION_REASONS, type BookingRejectionReason } from '@skillswap/contracts';

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
