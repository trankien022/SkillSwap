import { BOOKING_LEAD_TIME_MS } from './class';
import {
  BOOKING_STATES,
  BookingNotAllowedError,
  INITIAL_BOOKING_STATE,
  SEAT_HOLDING_STATES,
  assertBookable,
  availableSeats,
  holdsSeat,
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
