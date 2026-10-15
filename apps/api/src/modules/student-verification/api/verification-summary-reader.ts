import type { VerificationStatus } from '@skillswap/contracts';

/**
 * FR-015 / ADR-034 §7: the operations dashboard's student-verification summary.
 *
 * A **facade port**, in the same shape as `account-profile/api/public-profile-reader.ts`: another
 * module may ask this one a question, but only through the interface published here, never by
 * reading its schema (ADR-014) or importing its internals (ADR-005/ADR-011). The dashboard
 * composes counts by calling this; the `student_verification` schema stays private.
 *
 * Deliberately counts-only. The dashboard is a landing surface — it answers "how much work is
 * waiting", and the queues themselves are the places to look at the work. Returning rows here
 * would duplicate the queue reads and their authorization story.
 */
export const VERIFICATION_SUMMARY_READER = Symbol('VERIFICATION_SUMMARY_READER');

export interface VerificationSummary {
  /** How many verifications sit in each status, across every account. */
  readonly byStatus: Readonly<Record<VerificationStatus, number>>;
  /** The sum of `byStatus`, so a caller does not have to re-add it. */
  readonly total: number;
}

export interface VerificationSummaryReader {
  read(): Promise<VerificationSummary>;
}
