/**
 * Booking aggregate (FR-007, FR-009, FR-011; SR-BR-004, SR-BR-010).
 *
 * This phase owns booking *eligibility*: whether a Learner may create a booking
 * for a class right now. It does not touch the wallet — a booking starts as
 * `pending` and holds a seat; confirming it against the ledger is FR-009.
 */

import {
  BOOKING_LEAD_TIME_MS,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  type ClassView,
} from './class';

export const BOOKING_STATES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'disputed',
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

export const INITIAL_BOOKING_STATE: BookingState = 'pending';

/** Booking states that occupy a seat (OQ-007 / AC-029). */
export const SEAT_HOLDING_STATES: readonly BookingState[] = ['pending', 'confirmed'];

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

export class BookingNotAllowedError extends Error {
  constructor(readonly reason: BookingRejectionReason, message: string) {
    super(message);
    this.name = 'BookingNotAllowedError';
  }
}

export function holdsSeat(state: BookingState): boolean {
  return SEAT_HOLDING_STATES.includes(state);
}

export interface ExistingBooking {
  learnerId: string;
  state: BookingState;
}

export interface BookingEligibilityInput {
  classView: Pick<ClassView, 'state' | 'startsAt' | 'durationMinutes' | 'capacity' | 'teacherId'>;
  learnerId: string;
  existingBookings: readonly ExistingBooking[];
  now: Date;
}

function seatsTaken(existingBookings: readonly ExistingBooking[]): number {
  return existingBookings.filter((booking) => holdsSeat(booking.state)).length;
}

/** Seats still available: capacity minus seats held by pending/confirmed bookings. */
export function availableSeats(
  capacity: number,
  existingBookings: readonly ExistingBooking[],
): number {
  return capacity - seatsTaken(existingBookings);
}

function reject(reason: BookingRejectionReason, message: string): never {
  throw new BookingNotAllowedError(reason, message);
}

/**
 * Enforces every FR-007 booking rule (AC-003, AC-010, BR-021/024/025, SR-BR-010)
 * and returns nothing when the booking may proceed as `pending`.
 */
export function assertBookable(input: BookingEligibilityInput): void {
  const { classView, learnerId, existingBookings, now } = input;

  if (classView.state !== 'published') {
    reject('class_not_bookable', `Class is not open for booking (state: ${classView.state})`);
  }

  if (
    classView.durationMinutes < MIN_DURATION_MINUTES ||
    classView.durationMinutes > MAX_DURATION_MINUTES ||
    !Number.isInteger(classView.durationMinutes)
  ) {
    reject('invalid_duration', `Class duration ${classView.durationMinutes} is out of range`);
  }

  if (classView.teacherId === learnerId) {
    reject('self_booking', 'A Teacher may not book their own class');
  }

  const leadTime = classView.startsAt.getTime() - now.getTime();
  if (leadTime <= 0) {
    reject('class_started', 'Class has already started');
  }
  if (leadTime < BOOKING_LEAD_TIME_MS) {
    reject('booking_window_closed', 'A booking must be created at least 24 hours before class start');
  }

  if (
    existingBookings.some(
      (booking) => booking.learnerId === learnerId && holdsSeat(booking.state),
    )
  ) {
    reject('duplicate_booking', 'Learner already has a valid booking for this class');
  }

  if (availableSeats(classView.capacity, existingBookings) <= 0) {
    reject('class_full', 'Class has no available seats');
  }
}
