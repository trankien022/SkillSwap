import type { StudentVerificationView } from '@skillswap/contracts';
import { InvalidRevocationError, revokeVerification } from '../domain/verification';
import type { VerificationRepository } from './port/out/verification-repository';
import type { Clock } from './port/out/clock';
import type {
  RevokeStudentVerificationCommand,
  RevokeStudentVerificationPort,
} from './port/in/revoke-student-verification';
import { VerificationNotFoundError } from './decide-student-verification.use-case';
import { toVerificationView } from './verification-view';

/**
 * FR-019 / ADR-025: revokes an effective verification. The admin role and the
 * reason rule live in the domain; the repository applies the state change and
 * writes the `student.verification.revoked` cascade event in one transaction.
 */
export class RevokeStudentVerificationUseCase implements RevokeStudentVerificationPort {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevokeStudentVerificationCommand): Promise<StudentVerificationView> {
    const verification = await this.verifications.findById(command.verificationId);
    if (verification === null) {
      throw new VerificationNotFoundError(command.verificationId);
    }

    // Asserts the admin role, the reason, and that the row is revocable.
    const revocation = revokeVerification(
      verification.status,
      { reason: command.reason },
      { reviewerRole: command.reviewerRole, reviewerId: command.reviewerId, now: this.clock.now() },
    );

    const result = await this.verifications.revoke({
      verificationId: verification.id,
      reviewerId: command.reviewerId,
      reason: revocation.reason,
      revokedAt: revocation.revokedAt,
    });
    if (!result.applied) {
      // Lost a race with another decision/revocation.
      throw new InvalidRevocationError(verification.status);
    }

    const updated = await this.verifications.findById(verification.id);
    return toVerificationView(updated ?? verification);
  }
}
