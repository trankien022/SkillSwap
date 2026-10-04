import type { ModuleStatusState } from '../../../domain/module-status';

export const STATUS_WRITER = Symbol('STATUS_WRITER');

export interface ModuleStatusWriteInput {
  previousState: ModuleStatusState;
  newState: ModuleStatusState;
  changedBy: string;
}

export interface ModuleStatusTransition {
  module: string;
  previousState: string;
  newState: string;
  changedAt: string;
  changedBy: string;
}

export interface ModuleStatusWriter {
  apply(input: ModuleStatusWriteInput): Promise<ModuleStatusTransition>;
}
