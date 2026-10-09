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

/** Port the UI depends on. */
export interface BookingGateway {
  getClass(classId: string): Promise<ClassView>;
  bookClass(classId: string, idempotencyKey: string): Promise<BookClassResult>;
}
