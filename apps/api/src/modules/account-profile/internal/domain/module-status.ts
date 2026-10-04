/** State machine for the Account profile module (ADR-010: state codes only). */

export const MODULE_NAME = 'account-profile';

export const STATUS_CHANGED_EVENT = 'account-profile.status.changed';

export const MODULE_STATUS_STATES = ['incomplete', 'active', 'suspended'] as const;

export type ModuleStatusState = (typeof MODULE_STATUS_STATES)[number];

export const INITIAL_MODULE_STATUS: ModuleStatusState = 'incomplete';

export const MODULE_STATUS_TRANSITIONS: Readonly<Record<ModuleStatusState, readonly ModuleStatusState[]>> = {
  incomplete: ['active'],
  active: ['suspended', 'incomplete'],
  suspended: ['active'],
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
