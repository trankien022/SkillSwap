export const COMPLETE_CLASS = Symbol('COMPLETE_CLASS');

export interface CompleteClassCommand {
  classId: string;
  teacherId: string;
}

export interface CompleteClassResult {
  completed: boolean;
  basis: string | null;
}

export interface CompleteClassPort {
  execute(command: CompleteClassCommand): Promise<CompleteClassResult>;
}
