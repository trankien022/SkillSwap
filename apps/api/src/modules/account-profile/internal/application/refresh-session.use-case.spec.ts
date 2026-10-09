import { AccountNotFoundError } from '../domain/account';
import { SessionExpiredError, SessionRevokedError } from '../domain/session';
import { RefreshSessionUseCase } from './refresh-session.use-case';
import type { SessionDeps } from './issue-session';
import {
  FakeAccountRepository,
  FakeClock,
  FakeSessionRepository,
  FakeTokenService,
} from './testing/fakes';

async function build() {
  const accounts = new FakeAccountRepository();
  const tokens = new FakeTokenService();
  const clock = new FakeClock();
  const sessions = new FakeSessionRepository();
  const deps: SessionDeps = { tokens, sessions, clock };
  const useCase = new RefreshSessionUseCase(accounts, sessions, tokens, clock, deps);
  return { accounts, tokens, clock, sessions, useCase };
}

describe('RefreshSessionUseCase', () => {
  it('rotates the session: old token is revoked, new token works once', async () => {
    const { accounts, tokens, sessions, useCase } = await build();
    const account = await accounts.create({
      email: 'a@b.co',
      displayName: 'An',
      role: 'learner',
      status: 'active',
    });
    const raw = 'manual-token';
    await sessions.create({
      accountId: account.id,
      refreshTokenHash: tokens.hashRefreshToken(raw),
      expiresAt: '2026-11-01T00:00:00.000Z',
    });

    const rotated = await useCase.execute({ refreshToken: raw });
    expect(rotated.refreshToken).not.toBe(raw);

    // Reusing the old token must fail because it was revoked during rotation.
    await expect(useCase.execute({ refreshToken: raw })).rejects.toThrow(SessionRevokedError);
  });

  it('rejects an unknown refresh token', async () => {
    const { useCase } = await build();
    await expect(useCase.execute({ refreshToken: 'nope' })).rejects.toThrow(AccountNotFoundError);
  });

  it('rejects an expired session', async () => {
    const { accounts, tokens, clock, sessions, useCase } = await build();
    const account = await accounts.create({
      email: 'a@b.co',
      displayName: 'An',
      role: 'learner',
      status: 'active',
    });
    clock.set(new Date('2026-12-01T00:00:00.000Z'));
    await sessions.create({
      accountId: account.id,
      refreshTokenHash: tokens.hashRefreshToken('expired'),
      expiresAt: '2026-11-01T00:00:00.000Z',
    });
    await expect(useCase.execute({ refreshToken: 'expired' })).rejects.toThrow(SessionExpiredError);
  });
});
