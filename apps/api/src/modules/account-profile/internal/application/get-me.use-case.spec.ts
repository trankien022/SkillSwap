import { AccountNotFoundError } from '../domain/account';
import { GetMeUseCase } from './get-me.use-case';
import { FakeAccountRepository } from './testing/fakes';

describe('GetMeUseCase', () => {
  it('returns the signed-in account view', async () => {
    const accounts = new FakeAccountRepository();
    const account = await accounts.create({
      email: 'a@b.co',
      displayName: 'An',
      role: 'teacher',
      status: 'active',
    });
    const useCase = new GetMeUseCase(accounts);
    await expect(useCase.execute(account.id)).resolves.toEqual({
      id: account.id,
      email: 'a@b.co',
      displayName: 'An',
      role: 'teacher',
      status: 'active',
    });
  });

  it('throws for an unknown account', async () => {
    const useCase = new GetMeUseCase(new FakeAccountRepository());
    await expect(useCase.execute('missing')).rejects.toThrow(AccountNotFoundError);
  });
});
