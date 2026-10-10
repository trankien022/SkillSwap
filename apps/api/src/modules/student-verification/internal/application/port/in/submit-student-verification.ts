import type { StudentVerificationView } from '@skillswap/contracts';

export const SUBMIT_STUDENT_VERIFICATION = Symbol('SubmitStudentVerification');

/** FR-002 / API-001: a Learner submits a student verification. */
export interface SubmitStudentVerificationCommand {
  accountId: string;
  schoolName: string;
  major?: string;
  documentRef: string;
}

export interface SubmitStudentVerificationPort {
  execute(command: SubmitStudentVerificationCommand): Promise<StudentVerificationView>;
}
