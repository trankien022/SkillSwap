/** State machine for the Skill verification module (ADR-010: state codes only). */

export const MODULE_NAME = 'skill-verification';

export const STATUS_CHANGED_EVENT = 'skill-verification.status.changed';

export const MODULE_STATUS_STATES = ['draft', 'submitted', 'assessing', 'verified', 'rejected'] as const;

export type ModuleStatusState = (typeof MODULE_STATUS_STATES)[number];

export const INITIAL_MODULE_STATUS: ModuleStatusState = 'draft';

export const MODULE_STATUS_TRANSITIONS: Readonly<Record<ModuleStatusState, readonly ModuleStatusState[]>> = {
  draft: ['submitted'],
  submitted: ['assessing'],
  assessing: ['verified', 'rejected', 'submitted'],
  verified: ['assessing'],
  rejected: ['draft'],
};

export class UnknownStateError extends Error {
  constructor(state: string) {
    super(`Unknown module status state: ${state}`);
    this.name = 'UnknownStateError';
  }
}

export class StatusTransitionError extends Error {
  constructor(from: ModuleStatusState, to: ModuleStatusState) {
    super(`Illegal module status transition: ${from} -> ${to}`);
    this.name = 'StatusTransitionError';
  }
}

export class StatusConflictError extends Error {
  constructor(expectedState: string, attemptedState: string) {
    super(`Status conflict: expected ${expectedState} while applying ${attemptedState}`);
    this.name = 'StatusConflictError';
  }
}

export function isModuleStatusState(value: string): value is ModuleStatusState {
  return (MODULE_STATUS_STATES as readonly string[]).includes(value);
}

export function assertModuleStatusState(value: string): asserts value is ModuleStatusState {
  if (!isModuleStatusState(value)) {
    throw new UnknownStateError(value);
  }
}

export function canTransition(from: ModuleStatusState, to: ModuleStatusState): boolean {
  return MODULE_STATUS_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ModuleStatusState, to: ModuleStatusState): void {
  if (!canTransition(from, to)) {
    throw new StatusTransitionError(from, to);
  }
}
