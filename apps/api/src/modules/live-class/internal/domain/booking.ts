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
  'learner_not_verified',
] as const;

export type BookingRejectionReason = (typeof BOOKING_REJECTION_REASONS)[number];

export class BookingNotAllowedError extends Error {
  constructor(readonly reason: BookingRejectionReason, message: string) {
    super(message);
    this.name = 'BookingNotAllowedError';
  }
}

/**
 * FR-007 / AC-034 / BR-001 (decided 2026-10-25, W1 gate C1/C2): an account with
 * **no effective approved student verification** may neither teach nor book. This
 * is the booking half of BR-001; the teaching half is `UnverifiedTeacherError` on
 * the publish gate.
 *
 * It carries `reason` so the HTTP filter maps it to a stable 409 code, exactly as
 * it does for `BookingNotAllowedError`. It does NOT extend that class: the
 * decision was to gate booking, and a distinct type makes the two trust failures
 * separable in logs and telemetry.
 */
export class LearnerNotVerifiedError extends Error {
  readonly reason: BookingRejectionReason = 'learner_not_verified';

  constructor(learnerId: string) {
    super(`Account ${learnerId} has no approved student verification`);
    this.name = 'LearnerNotVerifiedError';
  }
}

export function holdsSeat(state: BookingState): boolean {
  return SEAT_HOLDING_STATES.includes(state);
}

// ── FR-007 lifecycle remainder (ADR-019) ────────────────────────────────────

/** A pending hold auto-cancels after this long (OQ-007 / AC-026). */
export const DEFAULT_HOLD_TTL_MS = 15 * 60 * 1000;

/** A confirmed booking is a Teacher no-show after this window from start (AC-024). */
export const TEACHER_NO_SHOW_WINDOW_MS = 15 * 60 * 1000;

export const CANCEL_REASONS = [
  'expired',
  'class_cancelled',
  'teacher_no_show',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

/** States from which a booking may still transition to cancelled. */
export const CANCELLABLE_STATES: readonly BookingState[] = ['pending', 'confirmed'];

export function isCancellable(state: BookingState): boolean {
  return CANCELLABLE_STATES.includes(state);
}

/** A settled (charged) booking is the only one that warrants a refund. */
export function isRefundable(state: BookingState): boolean {
  return state === 'confirmed';
}

export function computeHoldExpiry(createdAt: Date, ttlMs: number = DEFAULT_HOLD_TTL_MS): Date {
  return new Date(createdAt.getTime() + ttlMs);
}

export function isPendingExpired(
  booking: { state: BookingState; expiresAt: Date | null },
  now: Date,
): boolean {
  if (booking.state !== 'pending' || booking.expiresAt === null) {
    return false;
  }
  return booking.expiresAt.getTime() <= now.getTime();
}

export function isTeacherNoShow(
  classView: { startsAt: Date },
  teacherJoinedAt: Date | null,
  now: Date,
  windowMs: number = TEACHER_NO_SHOW_WINDOW_MS,
): boolean {
  const windowEnds = classView.startsAt.getTime() + windowMs;
  if (now.getTime() < windowEnds) {
    return false;
  }
  return teacherJoinedAt === null || teacherJoinedAt.getTime() > windowEnds;
}

export class BookingTransitionError extends Error {
  constructor(from: BookingState, to: BookingState) {
    super(`Illegal booking transition: ${from} -> ${to}`);
    this.name = 'BookingTransitionError';
  }
}

/** Only a `pending` booking may become `confirmed` (FR-009 settlement). */
export function assertConfirmable(state: BookingState): void {
  if (state !== 'pending') {
    throw new BookingTransitionError(state, 'confirmed');
  }
}

/** Only a `pending` or `confirmed` booking may become `cancelled`. */
export function assertCancellable(state: BookingState): void {
  if (!isCancellable(state)) {
    throw new BookingTransitionError(state, 'cancelled');
  }
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
 * Enforces every FR-007 booking rule (AC-003, AC-010, AC-034, BR-001/021/024/025,
 * SR-BR-010) and returns nothing when the booking may proceed as `pending`.
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

/** The verifying capability this gate consumes — never the Learner's own claim. */
export interface LearnerVerification {
  /** True only for an effective `approved` student verification. */
  readonly verified: boolean;
}

/**
 * FR-007 / AC-034 / BR-001 (decided 2026-10-25): the **booking** trust gate.
 *
 * An account with no effective approved student verification may not book. The
 * gate lives on *booking*, not on confirmation, because BR-001 is a precondition
 * of using the service — so a rejected attempt leaves **no booking row, no
 * `pending` hold and no credit movement**. Browsing and searching stay open to
 * everyone (US-T1); only committing does not.
 *
 * "Effective" is decided by the caller from this module's trust projection
 * (ADR-024, `teacher_verified.verified`): the flag is only `true` while the latest
 * `student.verification.*` event for the account was `approved`. A revoked or
 * rejected account therefore loses the ability to book on its next attempt.
 */
export function assertBookerVerified(learnerId: string, verification: LearnerVerification): void {
  if (!verification.verified) {
    throw new LearnerNotVerifiedError(learnerId);
  }
}
