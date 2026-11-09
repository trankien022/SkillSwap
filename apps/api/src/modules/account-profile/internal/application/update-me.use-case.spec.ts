import { AccountNotFoundError } from '../domain/account';
import { FakeAccountRepository, FakeVerificationStatusProjector } from './testing/fakes';
import { UpdateMeUseCase } from './update-me.use-case';

describe('UpdateMeUseCase (MM8)', () => {
  it('updates the caller name and returns the complete current account projection', async () => {
    const accounts = new FakeAccountRepository();
    const account = await accounts.create({ email: 'learner@example.com', displayName: 'Before', role: 'user', status: 'active' });
    const projector = new FakeVerificationStatusProjector();
    const useCase = new UpdateMeUseCase(accounts, projector);

    await expect(useCase.execute(account.id, { displayName: '  After  ' })).resolves.toMatchObject({
      id: account.id,
      displayName: 'After',
      email: account.email,
      studentVerification: null,
    });
    await expect(accounts.findById(account.id)).resolves.toMatchObject({ displayName: 'After' });
  });

  it('does not update another or missing account id', async () => {
    const useCase = new UpdateMeUseCase(new FakeAccountRepository(), new FakeVerificationStatusProjector());
    await expect(useCase.execute('missing', { displayName: 'After' })).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});
