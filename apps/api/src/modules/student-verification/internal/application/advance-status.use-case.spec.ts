import { AdvanceStatusUseCase } from './advance-status.use-case';
import type { ModuleStatusReader } from './port/out/module-status-reader';
import type { ModuleStatusWriter } from './port/out/module-status-writer';
import {
  StatusConflictError,
  StatusTransitionError,
  UnknownStateError,
  type ModuleStatusState,
} from '../domain/module-status';

describe('AdvanceStatusUseCase (student-verification)', () => {
  function setup(initialState: ModuleStatusState) {
    const reader: ModuleStatusReader = {
      find: jest.fn().mockResolvedValue({ module: 'student-verification', state: initialState, updatedAt: null }),
    };
    const apply = jest.fn().mockResolvedValue({
      module: 'student-verification',
      previousState: initialState,
      newState: 'reviewing',
      changedAt: '2026-01-01T00:00:00.000Z',
      changedBy: 'user-1',
    });
    const writer: ModuleStatusWriter = { apply };
    return { useCase: new AdvanceStatusUseCase(reader, writer), apply };
  }

  it('advances along a legal transition', async () => {
    const { useCase, apply } = setup('pending');
    const result = await useCase.execute({ toState: 'reviewing', changedBy: 'user-1' });
    expect(apply).toHaveBeenCalledWith({
      previousState: 'pending',
      newState: 'reviewing',
      changedBy: 'user-1',
    });
    expect(result.newState).toBe('reviewing');
  });

  it('rejects an illegal transition without writing', async () => {
    const { useCase, apply } = setup('pending');
    await expect(useCase.execute({ toState: 'pending', changedBy: 'user-1' })).rejects.toThrow(
      StatusTransitionError,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('rejects an unknown state without writing', async () => {
    const { useCase, apply } = setup('pending');
    await expect(useCase.execute({ toState: 'bogus', changedBy: 'user-1' })).rejects.toThrow(
      UnknownStateError,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('propagates optimistic-lock conflicts from the writer', async () => {
    const { useCase, apply } = setup('pending');
    apply.mockRejectedValue(new StatusConflictError('pending', 'reviewing'));
    await expect(useCase.execute({ toState: 'reviewing', changedBy: 'user-1' })).rejects.toThrow(
      StatusConflictError,
    );
  });
});
