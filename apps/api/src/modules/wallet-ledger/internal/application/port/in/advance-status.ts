export const ADVANCE_STATUS = Symbol('ADVANCE_STATUS');

export interface AdvanceStatusCommand {
  toState: string;
  changedBy: string;
}

export interface AdvanceStatusResult {
  module: string;
  previousState: string;
  newState: string;
  changedAt: string;
  changedBy: string;
}

export interface AdvanceStatusPort {
  execute(command: AdvanceStatusCommand): Promise<AdvanceStatusResult>;
}
