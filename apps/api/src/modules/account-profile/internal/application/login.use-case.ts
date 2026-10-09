import type { TokenResponse } from '@skillswap/contracts';
import { assertAccountCanSignIn, InvalidCredentialsError } from '../domain/account';
import type { AccountRepository } from './port/out/account-repository';
import type { CredentialRepository } from './port/out/credential-repository';
import type { PasswordHasher } from './port/out/password-hasher';
import type { LoginInput, LoginPort } from './port/in/login';
import { issueSession, type SessionDeps } from './issue-session';

/** FR-001 / UC-007: verify credentials and open a session. */
export class LoginUseCase implements LoginPort {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly credentials: CredentialRepository,
    private readonly hasher: PasswordHasher,
    private readonly session: SessionDeps,
  ) {}

  async execute(input: LoginInput): Promise<TokenResponse> {
    const account = await this.accounts.findByEmail(input.email);
    if (account === null) {
      // Same error as a bad password so account existence is not leaked.
      throw new InvalidCredentialsError();
    }
    const stored = await this.credentials.findByAccountId(account.id);
    if (stored === null || !(await this.hasher.verify(input.password, stored))) {
      throw new InvalidCredentialsError();
    }
    assertAccountCanSignIn(account.status);
    return issueSession(account, this.session);
  }
}
