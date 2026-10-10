import { AccountNotFoundError } from '../domain/account';
import { GetMeUseCase } from './get-me.use-case';
import { FakeAccountRepository, FakeVerificationStatusProjector } from './testing/fakes';

async function seed() {
  const accounts = new FakeAccountRepository();
  const account = await accounts.create({
    email: 'a@b.co',
    displayName: 'An',
    role: 'teacher',
    status: 'active',
  });
  return { accounts, account };
}

describe('GetMeUseCase (FR-001 / FR-017)', () => {
  it('returns the signed-in account view with no verification', async () => {
    const { accounts, account } = await seed();
    const useCase = new GetMeUseCase(accounts, new FakeVerificationStatusProjector());
    await expect(useCase.execute(account.id)).resolves.toEqual({
      id: account.id,
      email: 'a@b.co',
      displayName: 'An',
      role: 'teacher',
      status: 'active',
      studentVerification: null,
    });
  });

  it('includes the projected verification status and reason', async () => {
    const { accounts, account } = await seed();
    const projector = new FakeVerificationStatusProjector();
    await projector.upsert({
      accountId: account.id,
      verificationId: 'v1',
      status: 'rejected',
      reason: 'Illegible document',
      occurredAt: '2026-10-10T00:00:00.000Z',
    });
    const useCase = new GetMeUseCase(accounts, projector);
    const view = await useCase.execute(account.id);
    expect(view.studentVerification).toEqual({ status: 'rejected', reason: 'Illegible document' });
  });

  it('throws for an unknown account', async () => {
    const useCase = new GetMeUseCase(new FakeAccountRepository(), new FakeVerificationStatusProjector());
    await expect(useCase.execute('missing')).rejects.toThrow(AccountNotFoundError);
  });
});
