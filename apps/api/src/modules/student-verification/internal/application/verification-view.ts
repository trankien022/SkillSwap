import type { StudentVerificationView } from '@skillswap/contracts';
import type { Verification } from '../domain/verification';

/** Maps the domain aggregate to the owner-scoped API view (ADR-023/ADR-025). */
export function toVerificationView(verification: Verification): StudentVerificationView {
  return {
    id: verification.id,
    status: verification.status,
    schoolName: verification.schoolName,
    major: verification.major,
    reviewerId: verification.reviewerId,
    // Rejection reason, or the revocation reason when revoked (FR-019).
    reason: verification.displayReason,
    decidedAt: verification.decidedAt?.toISOString() ?? null,
    submittedAt: verification.submittedAt.toISOString(),
  };
}
