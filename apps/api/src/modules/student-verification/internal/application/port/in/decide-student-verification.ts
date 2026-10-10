import type { StudentVerificationView } from '@skillswap/contracts';

export const DECIDE_STUDENT_VERIFICATION = Symbol('DecideStudentVerification');

/**
 * FR-002 / API-001: an Administrator approves or rejects a pending
 * verification. The role is asserted in the use case (NFR-009), not only the
 * route, so the rule holds regardless of adapter.
 */
export interface DecideStudentVerificationCommand {
  verificationId: string;
  reviewerId: string;
  reviewerRole: string | undefined;
  decision: 'approve' | 'reject';
  reason?: string;
  approvedMajor?: string;
}

export interface DecideStudentVerificationPort {
  execute(command: DecideStudentVerificationCommand): Promise<StudentVerificationView>;
}
