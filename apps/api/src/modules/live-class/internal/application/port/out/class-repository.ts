import type {
  ClassCancellationReason,
  ClassState,
  ClassView,
  CompletionBasis,
} from '../../../domain/class';

export const CLASS_REPOSITORY = Symbol('CLASS_REPOSITORY');

/**
 * FR-016 (W3): the kinds of reminder a class can receive. `starting_soon` is the only one today;
 * the union exists so `claimReminderAndEmit` cannot be called with an unchecked string and adding
 * a kind is a compile-time decision rather than a runtime surprise in `class_reminders.kind`.
 */
export type ClassReminderKind = 'starting_soon';

export interface PersistedClass {
  id: string;
  teacherId: string;
  state: ClassState;
  startsAt: Date;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
  description: string;
  skillIds: string[];
}

/** A class as needed by the FR-020 completion sweep. */
export interface CompletableClass {
  id: string;
  teacherId: string;
  state: ClassState;
  startsAt: Date;
  durationMinutes: number;
}

export interface CreateClassRecord {
  teacherId: string;
  state: ClassState;
  startsAt: Date;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
  description: string;
  skillIds: string[];
}

export interface ClassEdit {
  skillIds: string[];
  description: string;
  startsAt: Date;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

export interface ClassRepository {
  insert(record: CreateClassRecord): Promise<PersistedClass>;
  findById(id: string): Promise<PersistedClass | null>;
  /** FR-007 / AC-017: replace the editable facts of a class. */
  update(id: string, edit: ClassEdit): Promise<PersistedClass>;
  /** FR-007: mark a class cancelled (idempotent). */
  markCancelled(id: string): Promise<void>;
  /**
   * FR-020 (ADR-021): atomically start a class (`published|full -> in_progress`)
   * and, when it succeeds, write a `class.started` outbox row. Terminal states
   * and replays return `{ started: false }`.
   */
  startAndEmit(classId: string): Promise<{ started: boolean }>;
  /**
   * FR-020 (ADR-021): atomically complete a class (`published|full|in_progress
   * -> completed`) with an audited basis and emit `class.completed` carrying the
   * confirmed bookings, so the wallet releases their pending income. Replays
   * (already terminal) return `{ completed: false }`.
   */
  completeAndEmit(
    classId: string,
    basis: CompletionBasis,
  ): Promise<{ completed: boolean; bookingIds: string[] }>;
  /**
   * FR-020 (ADR-021): atomically cancel a class with an audited reason and emit
   * `class.cancelled`; used for the teacher no-show outcome. Idempotent.
   */
  cancelWithReason(
    classId: string,
    reason: ClassCancellationReason,
  ): Promise<{ cancelled: boolean }>;
  /** FR-020: classes past their scheduled end that still need an outcome. */
  findAwaitingCompletion(now: Date): Promise<CompletableClass[]>;
  /**
   * FR-020 / AC-035: classes that have started but have not reached their scheduled end
   * and still carry a live state, so the idle rule may close them early. Bounded by
   * `hasStarted` so an unstarted class can never be handed to the idle rule.
   */
  findInProgressBeforeEnd(now: Date): Promise<CompletableClass[]>;
  /**
   * FR-016 (W3): classes whose reminder window contains `now` and whose `starting_soon` reminder
   * has not been sent yet. The class state is filtered here (Published/Full only, W3 C2) because
   * this is a SQL fact; the pure rule `isReminderDue` states the same rule for callers that already
   * hold a class, and the two are asserted against each other in the use-case tests.
   */
  findAwaitingReminder(
    now: Date,
    offsetMinutes: number,
  ): Promise<Array<Pick<ClassView, 'id' | 'state' | 'startsAt'>>>;
  /**
   * FR-016 (W3): claims the reminder for this class and emits the event, atomically.
   *
   * Returns `reminded: false` when another sweep already claimed it — the unique key on
   * `class_reminders` is the lease, so this is the only way a second instance learns it lost.
   */
  claimReminderAndEmit(
    classId: string,
    kind: ClassReminderKind,
    startsAt: Date,
  ): Promise<{ reminded: boolean; participants: number }>;
}
