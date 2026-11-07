export const LIST_CLASSES = Symbol('LIST_CLASSES');

export const CLASS_LIFECYCLE_STATES = [
  'draft',
  'published',
  'full',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type ClassLifecycleStateDto = (typeof CLASS_LIFECYCLE_STATES)[number];

/** B2: the level vocabulary, mirrored from the shared contract so a client can switch on it. */
import type { ClassFormatDto, ClassLevelDto } from './class-facts';
export { CLASS_LEVELS, CLASS_FORMATS } from './class-facts';
export type { ClassLevelDto, ClassFormatDto } from './class-facts';

export type ClassCursorTuple = readonly [startsAtISO: string, id: string];

export interface ListClassesQuery {
  readonly callerId: string;
  readonly keyword?: string;
  readonly skillId?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly teacherId?: string;
  readonly state?: ClassLifecycleStateDto;
  readonly limit?: number;
  readonly cursor?: ClassCursorTuple;
}

export interface ClassListItemDto {
  readonly id: string;
  readonly teacherId: string;
  readonly teacherDisplayName: string;
  /** B4: whether the teacher is a currently verified student. */
  readonly verified: boolean;
  /** B4: the school behind that verification; null when unverified or not yet projected. */
  readonly schoolName: string | null;
  readonly skillIds: readonly string[];
  readonly title: string;
  /** B2: the level the class is taught at; null when it was never recorded. */
  readonly level: ClassLevelDto | null;
  /** B3: `one-on-one` for capacity 1, otherwise `group`. */
  readonly format: ClassFormatDto;
  readonly description: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly capacity: number;
  readonly confirmedBookingsCount: number;
  readonly availableSeats: number;
  readonly state: ClassLifecycleStateDto;
  readonly averageRating: null;
  readonly ratingsCount: 0;
}

export interface ListClassesPageDto {
  readonly items: readonly ClassListItemDto[];
  readonly nextCursor: ClassCursorTuple | null;
  readonly totalActiveTeachingCount?: number;
}

export interface ListClassesPort {
  execute(query: ListClassesQuery): Promise<ListClassesPageDto>;
}
