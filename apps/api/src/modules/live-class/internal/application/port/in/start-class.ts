export const START_CLASS = Symbol('START_CLASS');

export interface StartClassCommand {
  classId: string;
  teacherId: string;
}

export interface StartClassResult {
  started: boolean;
}

export interface StartClassPort {
  execute(command: StartClassCommand): Promise<StartClassResult>;
}
