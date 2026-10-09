import { EmailTakenError } from '../domain/account';
import { WeakPasswordError } from '../domain/credential';
import { RegisterAccountUseCase } from './register-account.use-case';
import type { SessionDeps } from './issue-session';
import {
  FakeAccountRepository,
  FakeClock,
  FakeCredentialRepository,
  FakePasswordHasher,
  FakeSessionRepository,
  FakeTokenService,
} from './testing/fakes';

function build(): { useCase: RegisterAccountUseCase; sessions: FakeSessionRepository } {
  const sessions = new FakeSessionRepository();
  const deps: SessionDeps = {
    tokens: new FakeTokenService(),
    sessions,
    clock: new FakeClock(),
  };
  const useCase = new RegisterAccountUseCase(
    new FakeAccountRepository(),
    new FakeCredentialRepository(),
    new FakePasswordHasher(),
    deps,
  );
  return { useCase, sessions };
}

describe('RegisterAccountUseCase', () => {
  it('creates an account, stores a hash and returns a session', async () => {
    const { useCase, sessions } = build();
    const result = await useCase.execute({
      email: 'An@Example.com',
      displayName: 'An',
      password: 'secret-password',
    });
    expect(result.accessToken).toContain('acct-');
    expect(result.tokenType).toBe('Bearer');
    expect(sessions.sessions.size).toBe(1);
  });

  it('rejects a weak password before touching storage', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute({ email: 'a@b.co', displayName: 'An', password: 'short' }),
    ).rejects.toThrow(WeakPasswordError);
  });

  it('rejects a duplicate email case-insensitively', async () => {
    const { useCase } = build();
    await useCase.execute({ email: 'a@b.co', displayName: 'An', password: 'secret-password' });
    await expect(
      useCase.execute({ email: 'A@B.CO', displayName: 'An 2', password: 'secret-password' }),
    ).rejects.toThrow(EmailTakenError);
  });
});
