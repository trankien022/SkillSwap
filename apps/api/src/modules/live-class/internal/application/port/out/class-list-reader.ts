import type { ClassCursorTuple, ClassLifecycleStateDto } from '../in/list-classes';

export const CLASS_LIST_READER = Symbol('CLASS_LIST_READER');

export interface FindClassesCriteria {
  readonly mode: 'marketplace' | 'own';
  readonly callerId: string;
  readonly teacherId?: string;
  readonly keyword?: string;
  readonly skillId?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly state?: ClassLifecycleStateDto;
  readonly minStartsAt?: Date;
  readonly limit: number;
  readonly cursor?: readonly [startsAt: Date, id: string];
  readonly now: Date;
}

export interface ClassListRecord {
  readonly id: string;
  readonly teacherId: string;
  readonly skillIds: readonly string[];
  readonly description: string;
  readonly startsAt: Date;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly capacity: number;
  readonly confirmedBookingsCount: number;
  readonly availableSeats: number;
  readonly state: ClassLifecycleStateDto;
}

export interface ClassListReaderResult {
  readonly items: readonly ClassListRecord[];
  readonly nextCursor: ClassCursorTuple | null;
}

export interface ClassListReader {
  findClasses(criteria: FindClassesCriteria): Promise<ClassListReaderResult>;
  countActiveTeaching(teacherId: string, now: Date): Promise<number>;
}
