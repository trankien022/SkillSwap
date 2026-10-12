import { InvalidVerifierTransitionError } from '../domain/verifier';
import { UnknownVerifierError } from '../domain/verifier';
import { ChangeVerifierStatusUseCase } from './change-verifier-status.use-case';
import { InMemoryVerifierRepository } from './testing/skill-evidence-fakes';

describe('ChangeVerifierStatusUseCase (FR-004 / ADR-027)', () => {
  it('suspends and reactivates an active Verifier', async () => {
    const repo = new InMemoryVerifierRepository([
      { accountId: 'vf-1', status: 'active', expertise: ['sk-1'] },
    ]);
    const useCase = new ChangeVerifierStatusUseCase(repo);

    expect((await useCase.execute({ verifierId: 'vf-1', status: 'suspended' })).status).toBe('suspended');
    expect((await useCase.execute({ verifierId: 'vf-1', status: 'active' })).status).toBe('active');
  });

  it('revokes permanently and refuses to revive a revoked Verifier', async () => {
    const repo = new InMemoryVerifierRepository([
      { accountId: 'vf-1', status: 'active', expertise: ['sk-1'] },
    ]);
    const useCase = new ChangeVerifierStatusUseCase(repo);

    expect((await useCase.execute({ verifierId: 'vf-1', status: 'revoked' })).status).toBe('revoked');
    await expect(useCase.execute({ verifierId: 'vf-1', status: 'active' })).rejects.toBeInstanceOf(
      InvalidVerifierTransitionError,
    );
  });

  it('rejects an unknown Verifier', async () => {
    const useCase = new ChangeVerifierStatusUseCase(new InMemoryVerifierRepository());
    await expect(useCase.execute({ verifierId: 'nope', status: 'suspended' })).rejects.toBeInstanceOf(
      UnknownVerifierError,
    );
  });
});
