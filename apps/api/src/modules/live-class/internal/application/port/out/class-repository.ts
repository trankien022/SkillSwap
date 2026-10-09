import type { ClassState } from '../../../domain/class';

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

export interface ClassRepository {
  insert(record: CreateClassRecord): Promise<PersistedClass>;
  findById(id: string): Promise<PersistedClass | null>;
}
