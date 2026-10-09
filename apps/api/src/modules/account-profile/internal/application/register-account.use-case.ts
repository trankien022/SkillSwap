import type { TokenResponse } from '@skillswap/contracts';
import { assertAccountRole, EmailTakenError, INITIAL_ACCOUNT_STATUS } from '../domain/account';
import { assertPasswordPolicy } from '../domain/credential';
import type { AccountRepository } from './port/out/account-repository';
import type { CredentialRepository } from './port/out/credential-repository';
import type { PasswordHasher } from './port/out/password-hasher';
import type { RegisterAccountInput, RegisterAccountPort } from './port/in/register-account';
import { issueSession, type SessionDeps } from './issue-session';

/** FR-001 / UC-006: create a local account and return a first session. */
export class RegisterAccountUseCase implements RegisterAccountPort {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly credentials: CredentialRepository,
    private readonly hasher: PasswordHasher,
    private readonly session: SessionDeps,
  ) {}

  async execute(input: RegisterAccountInput): Promise<TokenResponse> {
    assertPasswordPolicy(input.password);
    const role = input.role ?? 'learner';
    assertAccountRole(role);

    const existing = await this.accounts.findByEmail(input.email);
    if (existing !== null) {
      throw new EmailTakenError(input.email);
    }

    const account = await this.accounts.create({
      email: input.email,
      displayName: input.displayName,
      role,
      status: INITIAL_ACCOUNT_STATUS,
    });
    await this.credentials.save(account.id, await this.hasher.hash(input.password));
    return issueSession(account, this.session);
  }
}
