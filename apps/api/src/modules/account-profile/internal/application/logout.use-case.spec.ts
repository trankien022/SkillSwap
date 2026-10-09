import { LogoutUseCase } from './logout.use-case';
import { FakeSessionRepository, FakeTokenService } from './testing/fakes';

describe('LogoutUseCase', () => {
  it('revokes the matching session and is idempotent for unknown tokens', async () => {
    const tokens = new FakeTokenService();
    const sessions = new FakeSessionRepository();
    await sessions.create({
      accountId: 'acct-1',
      refreshTokenHash: tokens.hashRefreshToken('refresh-1'),
      expiresAt: '2026-11-01T00:00:00.000Z',
    });

    const useCase = new LogoutUseCase(sessions, tokens);
    await useCase.execute({ refreshToken: 'refresh-1' });
    const stored = await sessions.findByTokenHash(tokens.hashRefreshToken('refresh-1'));
    expect(stored?.revokedAt).not.toBeNull();

    await expect(useCase.execute({ refreshToken: 'unknown' })).resolves.toBeUndefined();
  });
});
