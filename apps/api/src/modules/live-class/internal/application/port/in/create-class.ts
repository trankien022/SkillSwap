export const CREATE_CLASS = Symbol('CREATE_CLASS');

/** FR-005 / API-004: publish a class. Verification checks are stubbed for now. */
export interface CreateClassCommand {
  teacherId: string;
  skillIds: string[];
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

export interface ClassResource {
  id: string;
  teacherId: string;
  state: string;
  title: string;
  /** B2: the level the class is taught at; null only for rows recorded before the column. */
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  /** B3: `one-on-one` for capacity 1, otherwise `group`. */
  format: 'one-on-one' | 'group';
  startsAt: string;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

export type CreateClassResult = ClassResource;

export interface CreateClassPort {
  execute(command: CreateClassCommand): Promise<CreateClassResult>;
}
