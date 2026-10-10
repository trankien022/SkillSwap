import { randomUUID } from 'node:crypto';
import type { StudentVerificationView } from '@skillswap/contracts';
import { DuplicateActiveVerificationError, Verification } from '../domain/verification';
import type { VerificationRepository } from './port/out/verification-repository';
import type { Clock } from './port/out/clock';
import type {
  SubmitStudentVerificationCommand,
  SubmitStudentVerificationPort,
} from './port/in/submit-student-verification';
import { toVerificationView } from './verification-view';

/**
 * FR-002 / AC-001: a Learner submits a student verification. Blocked while an
 * effective (pending|approved) verification already exists (SR-BR-011); the
 * database's partial unique index is the race-safe backstop.
 */
export class SubmitStudentVerificationUseCase implements SubmitStudentVerificationPort {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: SubmitStudentVerificationCommand): Promise<StudentVerificationView> {
    const existing = await this.verifications.findEffective(command.accountId);
    if (existing !== null) {
      throw new DuplicateActiveVerificationError(command.accountId);
    }

    const verification = Verification.submit({
      id: randomUUID(),
      accountId: command.accountId,
      schoolName: command.schoolName,
      major: command.major ?? null,
      documentRef: command.documentRef,
      submittedAt: this.clock.now(),
    });

    const stored = await this.verifications.create({
      id: verification.id,
      accountId: verification.accountId,
      schoolName: verification.schoolName,
      major: verification.major,
      documentRef: verification.documentRef,
      submittedAt: verification.submittedAt,
    });
    return toVerificationView(stored);
  }
}
