import { InvalidVerifierTransitionError } from '../domain/verifier';
import { UnknownVerifierError } from '../domain/verifier';
import { ChangeVerifierStatusUseCase } from './change-verifier-status.use-case';
import { InMemoryVerifierRepository } from './testing/skill-evidence-fakes';

// ADR-035: the Administrator acting; distinct from the Verifier being changed.
const ADMIN = '8a1e0000-0000-4000-8000-000000000b02';

describe('ChangeVerifierStatusUseCase (FR-004 / ADR-027)', () => {
  it('suspends and reactivates an active Verifier', async () => {
    const repo = new InMemoryVerifierRepository([
      { accountId: 'vf-1', status: 'active', expertise: ['sk-1'] },
    ]);
    const useCase = new ChangeVerifierStatusUseCase(repo);

    expect((await useCase.execute({ verifierId: 'vf-1', status: 'suspended', actorId: ADMIN })).status).toBe('suspended');
    expect((await useCase.execute({ verifierId: 'vf-1', status: 'active', actorId: ADMIN })).status).toBe('active');
  });

  it('revokes permanently and refuses to revive a revoked Verifier', async () => {
    const repo = new InMemoryVerifierRepository([
      { accountId: 'vf-1', status: 'active', expertise: ['sk-1'] },
    ]);
    const useCase = new ChangeVerifierStatusUseCase(repo);

    expect((await useCase.execute({ verifierId: 'vf-1', status: 'revoked', actorId: ADMIN })).status).toBe('revoked');
    await expect(useCase.execute({ verifierId: 'vf-1', status: 'active', actorId: ADMIN })).rejects.toBeInstanceOf(
      InvalidVerifierTransitionError,
    );
  });

  it('rejects an unknown Verifier', async () => {
    const useCase = new ChangeVerifierStatusUseCase(new InMemoryVerifierRepository());
    await expect(
      useCase.execute({ verifierId: 'nope', status: 'suspended', actorId: ADMIN }),
    ).rejects.toBeInstanceOf(
      UnknownVerifierError,
    );
  });
});
