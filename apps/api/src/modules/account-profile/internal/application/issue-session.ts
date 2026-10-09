import type { TokenResponse } from '@skillswap/contracts';
import type { Account } from '../domain/account';
import type { Clock, TokenService } from './port/out/token-service';
import type { SessionRepository } from './port/out/session-repository';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionDeps {
  readonly tokens: TokenService;
  readonly sessions: SessionRepository;
  readonly clock: Clock;
}

/** Issues an access token plus a fresh, stored refresh session for an account. */
export async function issueSession(account: Account, deps: SessionDeps): Promise<TokenResponse> {
  const access = deps.tokens.issueAccessToken({
    accountId: account.id,
    email: account.email,
    role: account.role,
  });
  const refreshToken = deps.tokens.newRefreshToken();
  await deps.sessions.create({
    accountId: account.id,
    refreshTokenHash: deps.tokens.hashRefreshToken(refreshToken),
    expiresAt: new Date(deps.clock.now().getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
  });
  return {
    accessToken: access.token,
    refreshToken,
    expiresIn: access.expiresInSeconds,
    tokenType: 'Bearer',
  };
}
