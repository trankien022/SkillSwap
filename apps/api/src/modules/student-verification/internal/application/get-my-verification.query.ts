import type { StudentVerificationView } from '@skillswap/contracts';
import type { VerificationRepository } from './port/out/verification-repository';
import type { GetMyVerificationPort } from './port/in/get-my-verification';
import { toVerificationView } from './verification-view';

/**
 * FR-002 / FR-017: the owner-scoped view of the account's latest verification
 * (status + rejection reason). Returns null when the account never submitted.
 */
export class GetMyVerificationQueryHandler implements GetMyVerificationPort {
  constructor(private readonly verifications: VerificationRepository) {}

  async execute(accountId: string): Promise<StudentVerificationView | null> {
    const verification = await this.verifications.findLatestByAccount(accountId);
    return verification === null ? null : toVerificationView(verification);
  }
}
