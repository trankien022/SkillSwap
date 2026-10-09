import type { TokenService } from './port/out/token-service';
import type { SessionRepository } from './port/out/session-repository';
import type { LogoutInput, LogoutPort } from './port/in/logout';

/** FR-001: revoke the presented refresh session. Idempotent. */
export class LogoutUseCase implements LogoutPort {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const existing = await this.sessions.findByTokenHash(this.tokens.hashRefreshToken(input.refreshToken));
    if (existing !== null) {
      await this.sessions.revoke(existing.id);
    }
  }
}
