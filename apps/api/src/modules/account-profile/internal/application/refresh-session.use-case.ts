import type { TokenResponse } from '@skillswap/contracts';
import { assertAccountCanSignIn, AccountNotFoundError } from '../domain/account';
import { assertSessionActive } from '../domain/session';
import type { AccountRepository } from './port/out/account-repository';
import type { Clock, TokenService } from './port/out/token-service';
import type { SessionRepository } from './port/out/session-repository';
import type { RefreshSessionInput, RefreshSessionPort } from './port/in/refresh-session';
import { issueSession, type SessionDeps } from './issue-session';

/** FR-001 / ADR-016: single-use refresh rotation. */
export class RefreshSessionUseCase implements RefreshSessionPort {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
    private readonly clock: Clock,
    private readonly session: SessionDeps,
  ) {}

  async execute(input: RefreshSessionInput): Promise<TokenResponse> {
    const hash = this.tokens.hashRefreshToken(input.refreshToken);
    const existing = await this.sessions.findByTokenHash(hash);
    if (existing === null) {
      throw new AccountNotFoundError('session');
    }
    assertSessionActive(existing, this.clock.now());
    // Rotate: revoke the presented session before issuing a new one.
    await this.sessions.revoke(existing.id);

    const account = await this.accounts.findById(existing.accountId);
    if (account === null) {
      throw new AccountNotFoundError(existing.accountId);
    }
    assertAccountCanSignIn(account.status);
    return issueSession(account, this.session);
  }
}
