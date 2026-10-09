import { AccountSuspendedError, InvalidCredentialsError } from '../domain/account';
import { LoginUseCase } from './login.use-case';
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
async function build() {
  const accounts = new FakeAccountRepository();
  const credentials = new FakeCredentialRepository();
  const sessions = new FakeSessionRepository();
  const hasher = new FakePasswordHasher();
  const deps: SessionDeps = { tokens: new FakeTokenService(), sessions, clock: new FakeClock() };
  const register = new RegisterAccountUseCase(accounts, credentials, hasher, deps);
  const login = new LoginUseCase(accounts, credentials, hasher, deps);
  return { accounts, credentials, register, login };
}

describe('LoginUseCase', () => {
  it('signs in with correct credentials', async () => {
    const { register, login } = await build();
    await register.execute({ email: 'a@b.co', displayName: 'An', password: 'secret-password' });
    const result = await login.execute({ email: 'a@b.co', password: 'secret-password' });
    expect(result.refreshToken).toBeDefined();
  });

  it('rejects a wrong password and an unknown account with the same error', async () => {
    const { register, login } = await build();
    await register.execute({ email: 'a@b.co', displayName: 'An', password: 'secret-password' });
    await expect(login.execute({ email: 'a@b.co', password: 'nope' })).rejects.toThrow(
      InvalidCredentialsError,
    );
    await expect(login.execute({ email: 'ghost@b.co', password: 'secret-password' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('rejects a suspended account', async () => {
    const { accounts, credentials, login } = await build();
    const suspended = await accounts.create({
      email: 'susp@b.co',
      displayName: 'S',
      role: 'learner',
      status: 'suspended',
    });
    await credentials.save(suspended.id, {
      algorithm: 'scrypt',
      salt: 'salt',
      hash: 'hash:secret-password',
      keyLength: 64,
    });
    await expect(login.execute({ email: 'susp@b.co', password: 'secret-password' })).rejects.toThrow(
      AccountSuspendedError,
    );
  });
});
