import type { StudentVerificationView } from '@skillswap/contracts';

export const GET_MY_VERIFICATION = Symbol('GetMyVerification');

/**
 * FR-002 / FR-017: the owner-scoped view of the account's current verification
 * (status + rejection reason), consumed by the account-status screen.
 */
export interface GetMyVerificationPort {
  execute(accountId: string): Promise<StudentVerificationView | null>;
}
