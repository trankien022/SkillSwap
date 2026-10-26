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
  isCompletionBasis,
  isRatingEligible,
  isReminderDue,
  scheduledEnd,
  publishClass,
  type ClassDraft,
  type ClassState,
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
    expect(() => assertCompletionBasis('guess')).toThrow(InvalidCompletionBasisError);
  });

  // ADR-021 Amendment A / AC-035: the teacher-initiated basis is gone, not merely unguarded.
  it('rejects the removed teacher_ended basis', () => {
    expect(() => assertCompletionBasis('teacher_ended')).toThrow(InvalidCompletionBasisError);
    expect(isCompletionBasis('teacher_ended')).toBe(false);
  });
});

describe('class reminder eligibility (FR-016 / W3)', () => {
  // 10:00Z on 2026-10-12; the 15-minute window opens at 09:45Z.
  const startsAt = new Date('2026-10-12T10:00:00.000Z');
  const at = (iso: string): Date => new Date(iso);
  const cls = (state: ClassState) => ({ state, startsAt });

  it('reminds inside the window and not before it', () => {
    // C1: one reminder at starts_at - 15 min, so 09:45:00 is the first honest moment.
    expect(isReminderDue(cls('published'), at('2026-10-12T09:44:59.999Z'))).toBe(false);
    expect(isReminderDue(cls('published'), at('2026-10-12T09:45:00.000Z'))).toBe(true);
    expect(isReminderDue(cls('published'), at('2026-10-12T09:52:00.000Z'))).toBe(true);
    expect(isReminderDue(cls('published'), at('2026-10-12T09:59:59.999Z'))).toBe(true);
  });

  it('stops at starts_at, because a reminder for a class under way is just late', () => {
    expect(isReminderDue(cls('published'), startsAt)).toBe(false);
    expect(isReminderDue(cls('published'), at('2026-10-12T10:00:00.001Z'))).toBe(false);
  });

  it('reminds for both bookable states and neither terminal one (C2)', () => {
    const due = at('2026-10-12T09:50:00.000Z');
    expect(isReminderDue(cls('published'), due)).toBe(true);
    expect(isReminderDue(cls('full'), due)).toBe(true);
    expect(isReminderDue(cls('cancelled'), due)).toBe(false);
    expect(isReminderDue(cls('completed'), due)).toBe(false);
    expect(isReminderDue(cls('in_progress'), due)).toBe(false);
    expect(isReminderDue(cls('draft'), due)).toBe(false);
  });

  it('covers every declared state, so a new one cannot default to reminding', () => {
    // A state added later must make a deliberate choice; until it does, the list above is the
    // contract and this assertion is what forces the author to touch it.
    const due = at('2026-10-12T09:50:00.000Z');
    const reminding = CLASS_STATES.filter((state) => isReminderDue(cls(state), due));
    expect(reminding).toEqual(['published', 'full']);
  });

  it('honours an explicit offset instead of assuming fifteen minutes', () => {
    // W3 C1 is a Product Owner number, not a property of the code: a 30-minute reminder moves
    // only the lower bound, and the upper bound stays anchored to starts_at.
    expect(isReminderDue(cls('published'), at('2026-10-12T09:29:59.999Z'), 30)).toBe(false);
    expect(isReminderDue(cls('published'), at('2026-10-12T09:30:00.000Z'), 30)).toBe(true);
    expect(isReminderDue(cls('published'), at('2026-10-12T09:59:00.000Z'), 30)).toBe(true);
    expect(isReminderDue(cls('published'), startsAt, 30)).toBe(false);
  });

  it('is timezone-independent, because every value is an absolute instant', () => {
    // The same instant written two ways is the same instant; nothing here reads a local clock.
    expect(isReminderDue(cls('published'), at('2026-10-12T16:50:00.000+07:00'))).toBe(true);
    expect(isReminderDue(cls('published'), at('2026-10-12T09:50:00.000Z'))).toBe(true);
  });
});
