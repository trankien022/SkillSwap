import { AdvanceStatusUseCase } from './advance-status.use-case';
import type { ModuleStatusReader } from './port/out/module-status-reader';
import type { ModuleStatusWriter } from './port/out/module-status-writer';
import {
  StatusConflictError,
  StatusTransitionError,
  UnknownStateError,
  type ModuleStatusState,
} from '../domain/module-status';

describe('AdvanceStatusUseCase (skill-verification)', () => {
  function setup(initialState: ModuleStatusState) {
    const reader: ModuleStatusReader = {
      find: jest.fn().mockResolvedValue({ module: 'skill-verification', state: initialState, updatedAt: null }),
    };
    const apply = jest.fn().mockResolvedValue({
      module: 'skill-verification',
      previousState: initialState,
      newState: 'submitted',
      changedAt: '2026-01-01T00:00:00.000Z',
      changedBy: 'user-1',
    });
    const writer: ModuleStatusWriter = { apply };
    return { useCase: new AdvanceStatusUseCase(reader, writer), apply };
  }

  it('advances along a legal transition', async () => {
    const { useCase, apply } = setup('draft');
    const result = await useCase.execute({ toState: 'submitted', changedBy: 'user-1' });
    expect(apply).toHaveBeenCalledWith({
      previousState: 'draft',
      newState: 'submitted',
      changedBy: 'user-1',
    });
    expect(result.newState).toBe('submitted');
  });

  it('rejects an illegal transition without writing', async () => {
    const { useCase, apply } = setup('draft');
    await expect(useCase.execute({ toState: 'draft', changedBy: 'user-1' })).rejects.toThrow(
      StatusTransitionError,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('rejects an unknown state without writing', async () => {
    const { useCase, apply } = setup('draft');
    await expect(useCase.execute({ toState: 'bogus', changedBy: 'user-1' })).rejects.toThrow(
      UnknownStateError,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('propagates optimistic-lock conflicts from the writer', async () => {
    const { useCase, apply } = setup('draft');
    apply.mockRejectedValue(new StatusConflictError('draft', 'submitted'));
    await expect(useCase.execute({ toState: 'submitted', changedBy: 'user-1' })).rejects.toThrow(
      StatusConflictError,
    );
  });
});
