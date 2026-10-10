import type {
  ClassCancellationReason,
  ClassState,
  CompletionBasis,
} from '../../../domain/class';

export const CLASS_REPOSITORY = Symbol('CLASS_REPOSITORY');

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
}
