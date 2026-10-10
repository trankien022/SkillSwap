import type { StudentVerificationView } from '@skillswap/contracts';
import { decideVerification } from '../domain/verification';
import type { VerificationRepository } from './port/out/verification-repository';
import type { Clock } from './port/out/clock';
import type {
  DecideStudentVerificationCommand,
  DecideStudentVerificationPort,
} from './port/in/decide-student-verification';
import { toVerificationView } from './verification-view';

export class VerificationNotFoundError extends Error {
  constructor(verificationId: string) {
    super(`Student verification ${verificationId} was not found`);
    this.name = 'VerificationNotFoundError';
  }
}

export class VerificationNotPendingError extends Error {
  constructor(verificationId: string) {
    super(`Student verification ${verificationId} is not pending and cannot be decided`);
    this.name = 'VerificationNotPendingError';
  }
}

/**
 * FR-002 / AC-001/AC-012: an Administrator approves or rejects a pending
 * verification. The role guard and the rejection-reason rule live in the domain
 * (`decideVerification`); the repository applies the decision and writes the
 * outbox event in one transaction (ADR-013).
 */
export class DecideStudentVerificationUseCase implements DecideStudentVerificationPort {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: DecideStudentVerificationCommand): Promise<StudentVerificationView> {
    const verification = await this.verifications.findById(command.verificationId);
    if (verification === null) {
      throw new VerificationNotFoundError(command.verificationId);
    }
    if (verification.status !== 'pending') {
      throw new VerificationNotPendingError(command.verificationId);
    }

    // Asserts the admin role and the rejection-reason rule (AC-012).
    const decision = decideVerification(
      verification.status,
      {
        decision: command.decision,
        reason: command.reason,
        major: command.approvedMajor,
      },
      { reviewerRole: command.reviewerRole, reviewerId: command.reviewerId, now: this.clock.now() },
    );

    await this.verifications.decide({
      verificationId: verification.id,
      status: decision.status,
      reviewerId: decision.reviewerId,
      reason: decision.reason ?? null,
      major: decision.major ?? null,
      decidedAt: decision.decidedAt,
    });

    const updated = await this.verifications.findById(verification.id);
    // The row was just updated by this call, so it must exist.
    return toVerificationView(updated ?? verification);
  }
}
