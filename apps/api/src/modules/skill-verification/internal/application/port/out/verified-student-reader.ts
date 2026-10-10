export const VERIFIED_STUDENT_READER = Symbol('VerifiedStudentReader');

/**
 * FR-003 / ADR-024: this module keeps its own local projection of the
 * `student.verification.*` events (never a cross-schema read) so it can tell
 * whether an account is a **verified student** before allowing a submission.
 */
export interface VerifiedStudentReader {
  /** Whether the account is currently a verified student (status `approved`). */
  isVerifiedStudent(accountId: string): Promise<boolean>;
}
