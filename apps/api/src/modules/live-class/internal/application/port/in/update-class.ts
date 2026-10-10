import type { ClassResource } from './create-class';

export const UPDATE_CLASS = Symbol('UPDATE_CLASS');

/** FR-007 / AC-017: partial edit of a published class. */
export interface UpdateClassCommand {
  classId: string;
  teacherId: string;
  skillIds?: string[];
  description?: string;
  startsAt?: string;
  durationMinutes?: number;
  priceCredits?: number;
  capacity?: number;
}

export interface UpdateClassPort {
  execute(command: UpdateClassCommand): Promise<ClassResource>;
}
