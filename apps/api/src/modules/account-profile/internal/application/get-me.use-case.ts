import type { MeResponse } from '@skillswap/contracts';
import { AccountNotFoundError } from '../domain/account';
import type { AccountRepository } from './port/out/account-repository';
import type { VerificationStatusReader } from './port/out/verification-status-projector';
import type { GetMePort } from './port/in/get-me';

/** FR-001/FR-017: read the signed-in account plus the projected verification status. */
export class GetMeUseCase implements GetMePort {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly verificationStatus: VerificationStatusReader,
  ) {}

  async execute(accountId: string): Promise<MeResponse> {
    const account = await this.accounts.findById(accountId);
    if (account === null) {
      throw new AccountNotFoundError(accountId);
    }
    const projected = await this.verificationStatus.findByAccount(accountId);
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      status: account.status,
      studentVerification:
        projected === null ? null : { status: projected.status, reason: projected.reason },
    };
  }
}
