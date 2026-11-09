import type { MeResponse, UpdateMeRequest } from '@skillswap/contracts';
import { AccountNotFoundError } from '../domain/account';
import type { AccountRepository } from './port/out/account-repository';
import type { VerificationStatusReader } from './port/out/verification-status-projector';
import type { UpdateMePort } from './port/in/update-me';

/** MM8: edits only the authenticated account's display name and returns its current profile. */
export class UpdateMeUseCase implements UpdateMePort {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly verificationStatus: VerificationStatusReader,
  ) {}

  async execute(accountId: string, input: UpdateMeRequest): Promise<MeResponse> {
    const account = await this.accounts.updateDisplayName(accountId, input.displayName.trim());
    if (account === null) throw new AccountNotFoundError(accountId);
    const projected = await this.verificationStatus.findByAccount(accountId);
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      status: account.status,
      studentVerification: projected === null ? null : { status: projected.status, reason: projected.reason },
    };
  }
}
