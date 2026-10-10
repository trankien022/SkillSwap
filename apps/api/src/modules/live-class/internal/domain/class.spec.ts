import {
  BOOKING_LEAD_TIME_MS,
  CLASS_STATES,
  ClassLockedError,
  ClassNotCompletableError,
  ClassTransitionError,
  INITIAL_CLASS_STATE,
  InvalidCapacityError,
  InvalidCompletionBasisError,
  InvalidDurationError,
  InvalidPriceError,
  InvalidStartTimeError,
  UnknownClassStateError,
  assertClassEditable,
  assertClassState,
  assertCompletable,
  assertCompletionBasis,
  assertTransition,
  canComplete,
  canTransition,
  completionOutcome,
  hasEnded,
  hasStarted,
  isClassState,
  isRatingEligible,
  scheduledEnd,
  publishClass,
  type ClassDraft,
} from './class';

const NOW = new Date('2026-10-08T00:00:00.000Z');

function draft(overrides: Partial<ClassDraft> = {}): ClassDraft {
  return {
    teacherId: 'teacher-1',
    startsAt: new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 1,
    ...overrides,
  };
}

describe('class aggregate', () => {
  it('declares a stable state machine', () => {
    expect(INITIAL_CLASS_STATE).toBe('draft');
    expect(CLASS_STATES).toContain('published');
    expect(canTransition('draft', 'published')).toBe(true);
    expect(canTransition('published', 'full')).toBe(true);
    expect(canTransition('full', 'published')).toBe(true);
    expect(canTransition('completed', 'published')).toBe(false);
    expect(() => assertTransition('completed', 'published')).toThrow(ClassTransitionError);
    expect(() => assertTransition('draft', 'published')).not.toThrow();
  });

  it('recognises only declared states', () => {
    expect(isClassState('full')).toBe(true);
    expect(isClassState('bogus')).toBe(false);
    expect(() => assertClassState('bogus')).toThrow(UnknownClassStateError);
    for (const state of CLASS_STATES) {
      expect(() => assertClassState(state)).not.toThrow();
    }
  });

  it('publishes a valid class', () => {
    const view = publishClass(draft(), NOW);
    expect(view).toEqual({
      teacherId: 'teacher-1',
      state: 'published',
      startsAt: draft().startsAt,
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 1,
    });
  });

  it('accepts duration boundaries of exactly 30 and 180 minutes', () => {
    expect(() => publishClass(draft({ durationMinutes: 30 }), NOW)).not.toThrow();
    expect(() => publishClass(draft({ durationMinutes: 180 }), NOW)).not.toThrow();
    expect(() => publishClass(draft({ durationMinutes: 29 }), NOW)).toThrow(InvalidDurationError);
    expect(() => publishClass(draft({ durationMinutes: 181 }), NOW)).toThrow(InvalidDurationError);
    expect(() => publishClass(draft({ durationMinutes: 60.5 }), NOW)).toThrow(InvalidDurationError);
  });

  it('requires a capacity of at least 1 (OQ-007)', () => {
    expect(() => publishClass(draft({ capacity: 1 }), NOW)).not.toThrow();
    expect(() => publishClass(draft({ capacity: 20 }), NOW)).not.toThrow();
    expect(() => publishClass(draft({ capacity: 0 }), NOW)).toThrow(InvalidCapacityError);
    expect(() => publishClass(draft({ capacity: -3 }), NOW)).toThrow(InvalidCapacityError);
    expect(() => publishClass(draft({ capacity: 2.5 }), NOW)).toThrow(InvalidCapacityError);
  });

  it('requires a positive integer price', () => {
    expect(() => publishClass(draft({ priceCredits: 1 }), NOW)).not.toThrow();
    expect(() => publishClass(draft({ priceCredits: 0 }), NOW)).toThrow(InvalidPriceError);
    expect(() => publishClass(draft({ priceCredits: -10 }), NOW)).toThrow(InvalidPriceError);
    expect(() => publishClass(draft({ priceCredits: 9.9 }), NOW)).toThrow(InvalidPriceError);
  });

  it('requires a future start time and a teacher', () => {
    expect(() => publishClass(draft({ startsAt: NOW }), NOW)).toThrow(InvalidStartTimeError);
    expect(() => publishClass(draft({ startsAt: new Date(NOW.getTime() - 1) }), NOW)).toThrow(
      InvalidStartTimeError,
    );
    expect(() => publishClass(draft({ teacherId: '  ' }), NOW)).toThrow(InvalidStartTimeError);
    expect(() => publishClass(draft({ startsAt: new Date('nope') }), NOW)).toThrow(
      InvalidStartTimeError,
    );
  });

  it('reports whether the class has started', () => {
    const view = publishClass(draft({ startsAt: new Date(NOW.getTime() + BOOKING_LEAD_TIME_MS) }), NOW);
    expect(hasStarted(view, NOW)).toBe(false);
    expect(hasStarted(view, new Date(NOW.getTime() + BOOKING_LEAD_TIME_MS))).toBe(true);
  });

  it('locks a class once it has a confirmed booking (AC-017)', () => {
    expect(() => assertClassEditable('cls-1', 0)).not.toThrow();
    expect(() => assertClassEditable('cls-1', 1)).toThrow(ClassLockedError);
    expect(() => assertClassEditable('cls-1', 3)).toThrow(ClassLockedError);
  });
});

describe('class lifecycle & completion (FR-020 / ADR-021)', () => {
  it('allows the approved transitions and blocks terminal ones', () => {
    expect(canComplete('published')).toBe(true);
    expect(canComplete('full')).toBe(true);
    expect(canComplete('in_progress')).toBe(true);
    expect(canComplete('completed')).toBe(false);
    expect(canComplete('cancelled')).toBe(false);
    expect(canComplete('draft')).toBe(false);
    expect(() => assertCompletable('completed')).toThrow(ClassNotCompletableError);
  });

  it('computes the scheduled end and detects it', () => {
    const view = { startsAt: new Date('2026-10-12T10:00:00.000Z'), durationMinutes: 60 };
    expect(scheduledEnd(view).toISOString()).toBe('2026-10-12T11:00:00.000Z');
    expect(hasEnded(view, new Date('2026-10-12T10:59:59.000Z'))).toBe(false);
    expect(hasEnded(view, new Date('2026-10-12T11:00:00.000Z'))).toBe(true);
  });

  it('completes at scheduled end when there is no teacher no-show', () => {
    expect(completionOutcome(false)).toEqual({
      state: 'completed',
      basis: 'scheduled_end',
      reason: null,
    });
  });

  it('cancels a teacher no-show class without a completion basis', () => {
    expect(completionOutcome(true)).toEqual({
      state: 'cancelled',
      basis: null,
      reason: 'teacher_no_show',
    });
  });

  it('treats only a completed class as rating-eligible', () => {
    expect(isRatingEligible('completed')).toBe(true);
    expect(isRatingEligible('in_progress')).toBe(false);
    expect(isRatingEligible('cancelled')).toBe(false);
  });

  it('validates the completion basis', () => {
    expect(() => assertCompletionBasis('scheduled_end')).not.toThrow();
    expect(() => assertCompletionBasis('teacher_ended')).not.toThrow();
    expect(() => assertCompletionBasis('guess')).toThrow(InvalidCompletionBasisError);
  });
});
