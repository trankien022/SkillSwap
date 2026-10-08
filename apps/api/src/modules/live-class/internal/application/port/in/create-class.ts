export const CREATE_CLASS = Symbol('CREATE_CLASS');

/** FR-005 / API-004: publish a class. Verification checks are stubbed for now. */
export interface CreateClassCommand {
  teacherId: string;
  skillIds: string[];
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
  startsAt: string;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}

export type CreateClassResult = ClassResource;

export interface CreateClassPort {
  execute(command: CreateClassCommand): Promise<CreateClassResult>;
}
