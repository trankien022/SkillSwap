import { BOOKING_LEAD_TIME_MS } from './class';
import {
  BOOKING_STATES,
  BookingNotAllowedError,
  BookingTransitionError,
  DEFAULT_HOLD_TTL_MS,
  INITIAL_BOOKING_STATE,
  SEAT_HOLDING_STATES,
  TEACHER_NO_SHOW_WINDOW_MS,
  assertBookable,
  assertCancellable,
  assertConfirmable,
  availableSeats,
  computeHoldExpiry,
  holdsSeat,
  isPendingExpired,
  isRefundable,
  isTeacherNoShow,
  type BookingEligibilityInput,
  type ExistingBooking,
} from './booking';

const NOW = new Date('2026-10-08T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function classView(overrides: Partial<BookingEligibilityInput['classView']> = {}) {
  return {
    state: 'published' as const,
    startsAt: new Date(NOW.getTime() + 48 * HOUR),
    durationMinutes: 60,
    capacity: 1,
    teacherId: 'teacher-1',
    ...overrides,
  };
}

function input(overrides: Partial<BookingEligibilityInput> = {}): BookingEligibilityInput {
  return {
    classView: classView(),
    learnerId: 'learner-1',
    existingBookings: [],
    now: NOW,
    ...overrides,
  };
}

describe('booking eligibility', () => {
  it('declares pending as the initial state and seat-holding states', () => {
    expect(INITIAL_BOOKING_STATE).toBe('pending');
    expect(BOOKING_STATES).toContain('confirmed');
    expect(SEAT_HOLDING_STATES).toEqual(['pending', 'confirmed']);
    expect(holdsSeat('pending')).toBe(true);
    expect(holdsSeat('confirmed')).toBe(true);
    expect(holdsSeat('cancelled')).toBe(false);
    expect(holdsSeat('completed')).toBe(false);
  });

  it('allows a valid booking', () => {
    expect(() => assertBookable(input())).not.toThrow();
  });

  it('rejects a booking under 24 hours before start without side effects (AC-003)', () => {
    const just = input({
      classView: classView({ startsAt: new Date(NOW.getTime() + BOOKING_LEAD_TIME_MS - 1) }),
    });
    expect(() => assertBookable(just)).toThrow(BookingNotAllowedError);
    try {
      assertBookable(just);
    } catch (error) {
      expect((error as BookingNotAllowedError).reason).toBe('booking_window_closed');
    }
  });

  it('accepts the exact 24-hour boundary', () => {
    expect(() =>
      assertBookable(
        input({ classView: classView({ startsAt: new Date(NOW.getTime() + BOOKING_LEAD_TIME_MS) }) }),
      ),
    ).not.toThrow();
  });

  it('rejects a booking once the class has started', () => {
    try {
      assertBookable(input({ classView: classView({ startsAt: new Date(NOW.getTime() - 1) }) }));
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as BookingNotAllowedError).reason).toBe('class_started');
    }
  });

  it('rejects a class that is not published (cancelled/full/draft)', () => {
    for (const state of ['draft', 'full', 'in_progress', 'completed', 'cancelled'] as const) {
      expect(() => assertBookable(input({ classView: classView({ state }) }))).toThrow(
        BookingNotAllowedError,
      );
    }
  });

  it('rejects a duplicate booking by the same learner (BR-024)', () => {
    const existing: ExistingBooking[] = [{ learnerId: 'learner-1', state: 'pending' }];
    try {
      assertBookable(input({ existingBookings: existing }));
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as BookingNotAllowedError).reason).toBe('duplicate_booking');
    }
  });

  it('allows a learner whose only prior booking was cancelled', () => {
    const existing: ExistingBooking[] = [{ learnerId: 'learner-1', state: 'cancelled' }];
    expect(() => assertBookable(input({ existingBookings: existing }))).not.toThrow();
  });

  it('rejects booking when capacity is reached (AC-010, BR-025)', () => {
    const existing: ExistingBooking[] = [{ learnerId: 'other', state: 'confirmed' }];
    try {
      assertBookable(input({ classView: classView({ capacity: 1 }), existingBookings: existing }));
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as BookingNotAllowedError).reason).toBe('class_full');
    }
  });

  it('counts pending and confirmed seats but not cancelled ones (AC-029)', () => {
    const existing: ExistingBooking[] = [
      { learnerId: 'a', state: 'pending' },
      { learnerId: 'b', state: 'confirmed' },
      { learnerId: 'c', state: 'cancelled' },
    ];
    expect(availableSeats(3, existing)).toBe(1);
    expect(() => assertBookable(input({ classView: classView({ capacity: 3 }), existingBookings: existing }))).not.toThrow();
  });

  it('rejects self-booking by the class teacher (SR-BR-010)', () => {
    try {
      assertBookable(input({ learnerId: 'teacher-1' }));
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as BookingNotAllowedError).reason).toBe('self_booking');
    }
  });

  it('rejects an out-of-range duration', () => {
    expect(() => assertBookable(input({ classView: classView({ durationMinutes: 29 }) }))).toThrow(
      BookingNotAllowedError,
    );
    expect(() => assertBookable(input({ classView: classView({ durationMinutes: 181 }) }))).toThrow(
      BookingNotAllowedError,
    );
  });
});

describe('booking lifecycle (FR-007 remainder / ADR-019)', () => {
  it('computes the hold expiry and detects expiry at the boundary', () => {
    const created = new Date('2026-10-08T00:00:00.000Z');
    const expiresAt = computeHoldExpiry(created);
    expect(expiresAt.getTime() - created.getTime()).toBe(DEFAULT_HOLD_TTL_MS);

    const atBoundary = new Date(expiresAt.getTime());
    expect(isPendingExpired({ state: 'pending', expiresAt }, atBoundary)).toBe(true);
    expect(isPendingExpired({ state: 'pending', expiresAt }, new Date(atBoundary.getTime() - 1))).toBe(
      false,
    );
  });

  it('never treats a confirmed or untimed booking as expired', () => {
    const now = new Date('2026-10-08T01:00:00.000Z');
    expect(isPendingExpired({ state: 'confirmed', expiresAt: new Date(0) }, now)).toBe(false);
    expect(isPendingExpired({ state: 'pending', expiresAt: null }, now)).toBe(false);
  });

  it('allows only pending -> confirmed', () => {
    expect(() => assertConfirmable('pending')).not.toThrow();
    expect(() => assertConfirmable('confirmed')).toThrow(BookingTransitionError);
    expect(() => assertConfirmable('cancelled')).toThrow(BookingTransitionError);
  });

  it('allows cancellation only from pending or confirmed', () => {
    expect(() => assertCancellable('pending')).not.toThrow();
    expect(() => assertCancellable('confirmed')).not.toThrow();
    expect(() => assertCancellable('cancelled')).toThrow(BookingTransitionError);
    expect(() => assertCancellable('completed')).toThrow(BookingTransitionError);
  });

  it('treats only a confirmed booking as refundable', () => {
    expect(isRefundable('confirmed')).toBe(true);
    expect(isRefundable('pending')).toBe(false);
    expect(isRefundable('cancelled')).toBe(false);
  });

  it('detects a teacher no-show only after the window closes with no join', () => {
    const startsAt = new Date('2026-10-08T00:00:00.000Z');
    const windowEnd = new Date(startsAt.getTime() + TEACHER_NO_SHOW_WINDOW_MS);
    // Before the window closes: not a no-show yet.
    expect(isTeacherNoShow({ startsAt }, null, new Date(windowEnd.getTime() - 1))).toBe(false);
    // At/after the window with no join: no-show.
    expect(isTeacherNoShow({ startsAt }, null, windowEnd)).toBe(true);
    // Joined within the window: not a no-show.
    const joinedIn = new Date(startsAt.getTime() + 60_000);
    expect(isTeacherNoShow({ startsAt }, joinedIn, windowEnd)).toBe(false);
    // Joined only after the window: no-show.
    const joinedLate = new Date(windowEnd.getTime() + 1);
    expect(isTeacherNoShow({ startsAt }, joinedLate, windowEnd)).toBe(true);
  });
});
