import type { StudentVerificationView } from '@skillswap/contracts';

export const REVOKE_STUDENT_VERIFICATION = Symbol('RevokeStudentVerification');

/**
 * FR-019 / ADR-025: an Administrator revokes an effective verification with a
 * reason. The role is asserted in the use case (NFR-009).
 */
export interface RevokeStudentVerificationCommand {
  verificationId: string;
  reviewerId: string;
  reviewerRole: string | undefined;
  reason: string;
}

export interface RevokeStudentVerificationPort {
  execute(command: RevokeStudentVerificationCommand): Promise<StudentVerificationView>;
}
