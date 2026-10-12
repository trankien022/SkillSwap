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
  readonly skillIds: readonly string[];
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
