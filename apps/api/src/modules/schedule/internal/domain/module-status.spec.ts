import {
  INITIAL_MODULE_STATUS,
  MODULE_NAME,
  MODULE_STATUS_STATES,
  MODULE_STATUS_TRANSITIONS,
  STATUS_CHANGED_EVENT,
  StatusTransitionError,
  UnknownStateError,
  assertModuleStatusState,
  assertTransition,
  canTransition,
  isModuleStatusState,
  type ModuleStatusState,
} from './module-status';

describe('schedule module status state machine', () => {
  it('declares an allowed initial state and stable names', () => {
    expect(MODULE_NAME).toBe('schedule');
    expect(STATUS_CHANGED_EVENT).toBe('schedule.status.changed');
    expect(MODULE_STATUS_STATES).toContain(INITIAL_MODULE_STATUS);
  });

  it('accepts every declared transition', () => {
    for (const [from, targets] of Object.entries(MODULE_STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(canTransition(from as ModuleStatusState, to)).toBe(true);
        expect(() => assertTransition(from as ModuleStatusState, to)).not.toThrow();
      }
    }
  });

  it('rejects every undeclared transition', () => {
    for (const from of MODULE_STATUS_STATES) {
      for (const to of MODULE_STATUS_STATES) {
        if (MODULE_STATUS_TRANSITIONS[from].includes(to)) continue;
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(StatusTransitionError);
      }
    }
  });

  it('rejects unknown states', () => {
    expect(isModuleStatusState('bogus')).toBe(false);
    expect(() => assertModuleStatusState('bogus')).toThrow(UnknownStateError);
    expect(() => assertModuleStatusState(INITIAL_MODULE_STATUS)).not.toThrow();
  });
});
