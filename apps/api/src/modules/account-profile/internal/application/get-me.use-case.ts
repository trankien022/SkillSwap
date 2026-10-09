import type { MeResponse } from '@skillswap/contracts';
import { AccountNotFoundError } from '../domain/account';
import type { AccountRepository } from './port/out/account-repository';
import type { GetMePort } from './port/in/get-me';

/** FR-001: read the signed-in account from the trusted identity. */
export class GetMeUseCase implements GetMePort {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(accountId: string): Promise<MeResponse> {
    const account = await this.accounts.findById(accountId);
    if (account === null) {
      throw new AccountNotFoundError(accountId);
    }
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      status: account.status,
    };
  }
}
