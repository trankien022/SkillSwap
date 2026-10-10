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
}
