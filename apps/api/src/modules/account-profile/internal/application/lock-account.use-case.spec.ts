import { AccountNotFoundError, InvalidSuspensionReasonError } from '../domain/account';
import { InvalidReactivationReasonError, LockAccountUseCase } from './lock-account.use-case';
import type { AccountLockRepository } from './port/out/account-repository';

const ADMIN_ACTOR = '8a1e0000-0000-4000-8000-0000000000a1';
const SUBJECT = '8a1e0000-0000-4000-8000-0000000000b2';
const NOW = new Date('2026-10-26T09:00:00.000Z');

function createRepository(
  result: Awaited<ReturnType<AccountLockRepository['changeStatus']>>,
) {
  const commands: Parameters<AccountLockRepository['changeStatus']>[0][] = [];
  const repository = {
    changeStatus: async (command: Parameters<AccountLockRepository['changeStatus']>[0]) => {
      commands.push(command);
      return result;
    },
    listSuspended: async () => [],
    countSuspended: async () => 0,
  } as unknown as AccountLockRepository;
  return { repository, commands };
}

function suspendedAccount(reason: string) {
  return {
    id: SUBJECT,
    email: 'minh@skillswap.test',
    displayName: 'Minh',
    role: 'user' as const,
    status: 'suspended' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    suspension: { reason, suspendedBy: ADMIN_ACTOR, suspendedAt: NOW.toISOString() },
  };
}

function activeAccount() {
  return {
    id: SUBJECT,
    email: 'minh@skillswap.test',
    displayName: 'Minh',
    role: 'user' as const,
    status: 'active' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('LockAccountUseCase (FR-015 / OQ-015 / ADR-037)', () => {
  it('suspends with a reason and reports the change', async () => {
    const { repository, commands } = createRepository({
      account: suspendedAccount('Repeated payment fraud'),
      changed: true,
    });
    const useCase = new LockAccountUseCase(repository, { now: () => NOW });

    const result = await useCase.execute({
      accountId: SUBJECT,
      status: 'suspended',
      reason: 'Repeated payment fraud',
      actorId: ADMIN_ACTOR,
    });

    expect(result).toEqual({
      accountId: SUBJECT,
      status: 'suspended',
      changed: true,
      reason: 'Repeated payment fraud',
    });
    // ADR-035: the actor travels on the command, distinct from the account being changed.
    expect(commands[0]?.actorId).toBe(ADMIN_ACTOR);
    expect(commands[0]?.accountId).toBe(SUBJECT);
    expect(commands[0]?.occurredAt).toBe(NOW);
  });

  it('trims the reason before storing it', async () => {
    const { repository, commands } = createRepository({
      account: suspendedAccount('Repeated payment fraud'),
      changed: true,
    });
    const useCase = new LockAccountUseCase(repository, { now: () => NOW });

    await useCase.execute({
      accountId: SUBJECT,
      status: 'suspended',
      reason: '  Repeated payment fraud  ',
      actorId: ADMIN_ACTOR,
    });

    expect(commands[0]?.reason).toBe('Repeated payment fraud');
  });

  it('refuses a suspension with no reason', async () => {
    const { repository, commands } = createRepository({
      account: suspendedAccount('x'),
      changed: true,
    });
    const useCase = new LockAccountUseCase(repository, { now: () => NOW });

    await expect(
      useCase.execute({ accountId: SUBJECT, status: 'suspended', reason: '   ', actorId: ADMIN_ACTOR }),
    ).rejects.toBeInstanceOf(InvalidSuspensionReasonError);
    await expect(
      useCase.execute({ accountId: SUBJECT, status: 'suspended', reason: null, actorId: ADMIN_ACTOR }),
    ).rejects.toBeInstanceOf(InvalidSuspensionReasonError);
    // Nothing was attempted: the rule runs before the write.
    expect(commands).toHaveLength(0);
  });

  it('refuses a reactivation that carries a reason rather than silently dropping it', async () => {
    const { repository, commands } = createRepository({
      account: activeAccount(),
      changed: true,
    });
    const useCase = new LockAccountUseCase(repository, { now: () => NOW });

    await expect(
      useCase.execute({ accountId: SUBJECT, status: 'active', reason: 'typo', actorId: ADMIN_ACTOR }),
    ).rejects.toBeInstanceOf(InvalidReactivationReasonError);
    expect(commands).toHaveLength(0);
  });

  it('reactivates with no reason', async () => {
    const { repository } = createRepository({ account: activeAccount(), changed: true });
    const useCase = new LockAccountUseCase(repository, { now: () => NOW });

    const result = await useCase.execute({
      accountId: SUBJECT,
      status: 'active',
      reason: null,
      actorId: ADMIN_ACTOR,
    });

    expect(result.changed).toBe(true);
    expect(result.status).toBe('active');
    expect(result.reason).toBeNull();
  });

  it('reports a repeat suspension as unchanged', async () => {
    const { repository } = createRepository({
      account: suspendedAccount('Repeated payment fraud'),
      changed: false,
    });
    const useCase = new LockAccountUseCase(repository, { now: () => NOW });

    const result = await useCase.execute({
      accountId: SUBJECT,
      status: 'suspended',
      reason: 'Repeated payment fraud',
      actorId: ADMIN_ACTOR,
    });

    expect(result.changed).toBe(false);
  });

  it('fails for an unknown account', async () => {
    const { repository } = createRepository(null);
    const useCase = new LockAccountUseCase(repository, { now: () => NOW });

    await expect(
      useCase.execute({ accountId: SUBJECT, status: 'suspended', reason: 'x', actorId: ADMIN_ACTOR }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});
