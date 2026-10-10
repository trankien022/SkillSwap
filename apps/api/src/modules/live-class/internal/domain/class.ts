/**
 * Class aggregate (FR-005, FR-007, FR-020; SR-BR-003).
 *
 * One Class is one scheduled online session (no Session entity). This aggregate
 * owns the scheduling and pricing facts FR-007 depends on: when it starts, how
 * long it lasts and how many seats it offers. Pure domain — no framework, no
 * persistence (ADR-009).
 */

export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 180;
export const BOOKING_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

/** Class lifecycle states (SkillSwap-SRS.md §3.2.6 state diagram). */
export const CLASS_STATES = [
  'draft',
  'published',
  'full',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export type ClassState = (typeof CLASS_STATES)[number];

export const INITIAL_CLASS_STATE: ClassState = 'draft';

const CLASS_TRANSITIONS: Readonly<Record<ClassState, readonly ClassState[]>> = {
  draft: ['published', 'cancelled'],
  published: ['full', 'in_progress', 'cancelled'],
  full: ['published', 'in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class UnknownClassStateError extends Error {
  constructor(state: string) {
    super(`Unknown class state: ${state}`);
    this.name = 'UnknownClassStateError';
  }
}

export class ClassTransitionError extends Error {
  constructor(from: ClassState, to: ClassState) {
    super(`Illegal class transition: ${from} -> ${to}`);
    this.name = 'ClassTransitionError';
  }
}

export class InvalidDurationError extends RangeError {
  constructor(minutes: number) {
    super(
      `Class duration must be an integer within [${MIN_DURATION_MINUTES}, ${MAX_DURATION_MINUTES}] minutes, got ${minutes}`,
    );
    this.name = 'InvalidDurationError';
  }
}

export class InvalidCapacityError extends RangeError {
  constructor(capacity: number) {
    super(`Class capacity must be a positive integer, got ${capacity}`);
    this.name = 'InvalidCapacityError';
  }
}

export class InvalidPriceError extends RangeError {
  constructor(priceCredits: number) {
    super(`Class price must be a positive integer number of credits, got ${priceCredits}`);
    this.name = 'InvalidPriceError';
  }
}

export class InvalidStartTimeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStartTimeError';
  }
}

export function isClassState(value: string): value is ClassState {
  return (CLASS_STATES as readonly string[]).includes(value);
}

export function assertClassState(value: string): asserts value is ClassState {
  if (!isClassState(value)) {
    throw new UnknownClassStateError(value);
  }
}

export function canTransition(from: ClassState, to: ClassState): boolean {
  return CLASS_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ClassState, to: ClassState): void {
  if (!canTransition(from, to)) {
    throw new ClassTransitionError(from, to);
  }
}

/** Facts a published class must satisfy (FR-005, BR-016/017, SR-BR-003). */
export interface ClassDraft {
  teacherId: string;
  startsAt: Date;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

export interface ClassView {
  id: string;
  teacherId: string;
  state: ClassState;
  startsAt: Date;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

/** Validated class facts, before an id is assigned by storage. */
export interface PublishedClass {
  teacherId: string;
  state: ClassState;
  startsAt: Date;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

function assertDuration(durationMinutes: number): void {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new InvalidDurationError(durationMinutes);
  }
}

function assertCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new InvalidCapacityError(capacity);
  }
}

function assertPrice(priceCredits: number): void {
  if (!Number.isInteger(priceCredits) || priceCredits < 1) {
    throw new InvalidPriceError(priceCredits);
  }
}

/**
 * Validates the publish rules and returns the class facts with state set to
 * `published`. Capacity is Teacher-supplied and must be >= 1 (OQ-007): 1 is a
 * 1-1 class, greater values are group classes.
 */
export function publishClass(draft: ClassDraft, now: Date): PublishedClass {
  if (draft.teacherId.trim() === '') {
    throw new InvalidStartTimeError('Class must have a teacher');
  }
  assertDuration(draft.durationMinutes);
  assertCapacity(draft.capacity);
  assertPrice(draft.priceCredits);
  if (Number.isNaN(draft.startsAt.getTime())) {
    throw new InvalidStartTimeError('Class start time is invalid');
  }
  if (draft.startsAt.getTime() <= now.getTime()) {
    throw new InvalidStartTimeError('Class must start in the future');
  }
  return {
    teacherId: draft.teacherId,
    state: 'published',
    startsAt: draft.startsAt,
    durationMinutes: draft.durationMinutes,
    priceCredits: draft.priceCredits,
    capacity: draft.capacity,
  };
}

/** True once the start time arrives, i.e. the class is no longer bookable. */
export function hasStarted(view: Pick<ClassView, 'startsAt'>, now: Date): boolean {
  return view.startsAt.getTime() <= now.getTime();
}

// ── FR-007 commitment lock (AC-017) ─────────────────────────────────────────

/** Fields a Teacher may edit. Once any booking is confirmed, none are editable. */
export const EDITABLE_CLASS_FIELDS = [
  'startsAt',
  'durationMinutes',
  'priceCredits',
  'capacity',
  'description',
  'skillIds',
] as const;

export class ClassLockedError extends Error {
  constructor(classId: string) {
    super(`Class ${classId} is locked once a booking is confirmed (AC-017)`);
    this.name = 'ClassLockedError';
  }
}

/**
 * AC-017: once a class has at least one confirmed booking, its committed facts
 * are frozen; only cancellation remains. `confirmedBookingCount` is supplied by
 * the caller from storage.
 */
export function assertClassEditable(classId: string, confirmedBookingCount: number): void {
  if (confirmedBookingCount > 0) {
    throw new ClassLockedError(classId);
  }
}

// ── FR-020 class lifecycle & completion (ADR-021) ───────────────────────────

export const COMPLETION_BASES = ['scheduled_end', 'teacher_ended'] as const;
export type CompletionBasis = (typeof COMPLETION_BASES)[number];

export const CLASS_CANCELLATION_REASONS = [
  'teacher_cancelled',
  'teacher_no_show',
] as const;
export type ClassCancellationReason = (typeof CLASS_CANCELLATION_REASONS)[number];

/** States from which a class may be confirmed complete (the Teacher held it). */
export const COMPLETABLE_STATES: readonly ClassState[] = ['published', 'full', 'in_progress'];

export class ClassNotCompletableError extends Error {
  constructor(state: ClassState) {
    super(`Class in state ${state} cannot be completed`);
    this.name = 'ClassNotCompletableError';
  }
}

export class InvalidCompletionBasisError extends Error {
  constructor(basis: string) {
    super(`Unknown completion basis: ${basis}`);
    this.name = 'InvalidCompletionBasisError';
  }
}

export function isCompletionBasis(value: string): value is CompletionBasis {
  return (COMPLETION_BASES as readonly string[]).includes(value);
}

export function assertCompletionBasis(value: string): asserts value is CompletionBasis {
  if (!isCompletionBasis(value)) {
    throw new InvalidCompletionBasisError(value);
  }
}

/** A class may complete only from a non-terminal state (idempotency: terminal = no-op). */
export function canComplete(state: ClassState): boolean {
  return COMPLETABLE_STATES.includes(state);
}

export function assertCompletable(state: ClassState): void {
  if (!canComplete(state)) {
    throw new ClassNotCompletableError(state);
  }
}

/** Auto-completion time for a class: `starts_at + duration` (ADR-021). */
export function scheduledEnd(view: Pick<ClassView, 'startsAt' | 'durationMinutes'>): Date {
  return new Date(view.startsAt.getTime() + view.durationMinutes * 60 * 1000);
}

/** True once the class has reached its scheduled end. */
export function hasEnded(view: Pick<ClassView, 'startsAt' | 'durationMinutes'>, now: Date): boolean {
  return scheduledEnd(view).getTime() <= now.getTime();
}

/**
 * ADR-021: a class is Completed unless the Teacher no-showed (FR-007 cancelled a
 * booking for `teacher_no_show`), in which case it is Cancelled and nothing is
 * released. Learner no-shows never change the outcome.
 */
export function completionOutcome(
  hasTeacherNoShow: boolean,
): { state: ClassState; basis: CompletionBasis | null; reason: ClassCancellationReason | null } {
  if (hasTeacherNoShow) {
    return { state: 'cancelled', basis: null, reason: 'teacher_no_show' };
  }
  return { state: 'completed', basis: 'scheduled_end', reason: null };
}

/** A completed class is the authorized basis for rating (FR-013 consumes this). */
export function isRatingEligible(state: ClassState): boolean {
  return state === 'completed';
}
