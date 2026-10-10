import { DuplicateActiveVerificationError, Verification } from '../../domain/verification';
import type { Clock } from '../port/out/clock';
import type {
  ApplyDecisionRequest,
  ApplyDecisionResult,
  CreateVerificationRequest,
  VerificationRepository,
} from '../port/out/verification-repository';

/** In-memory VerificationRepository for use-case specs. */
export class InMemoryVerificationRepository implements VerificationRepository {
  private readonly rows: Verification[] = [];

  async create(request: CreateVerificationRequest): Promise<Verification> {
    if (this.rows.some((row) => row.accountId === request.accountId && row.isEffective)) {
      throw new DuplicateActiveVerificationError(request.accountId);
    }
    const verification = Verification.submit({
      id: request.id,
      accountId: request.accountId,
      schoolName: request.schoolName,
      major: request.major,
      documentRef: request.documentRef,
      submittedAt: request.submittedAt,
    });
    this.rows.push(verification);
    return verification;
  }

  async findEffective(accountId: string): Promise<Verification | null> {
    return (
      [...this.rows].reverse().find((row) => row.accountId === accountId && row.isEffective) ?? null
    );
  }

  async findLatestByAccount(accountId: string): Promise<Verification | null> {
    return [...this.rows].reverse().find((row) => row.accountId === accountId) ?? null;
  }

  async findById(verificationId: string): Promise<Verification | null> {
    return this.rows.find((row) => row.id === verificationId) ?? null;
  }

  async decide(request: ApplyDecisionRequest): Promise<ApplyDecisionResult> {
    const index = this.rows.findIndex((row) => row.id === request.verificationId);
    if (index === -1 || this.rows[index].status !== 'pending') {
      return { applied: false };
    }
    const current = this.rows[index];
    this.rows[index] = Verification.reconstitute({
      id: current.id,
      accountId: current.accountId,
      schoolName: current.schoolName,
      major: request.major ?? current.major,
      documentRef: current.documentRef,
      status: request.status,
      reviewerId: request.reviewerId,
      reason: request.reason,
      decidedAt: request.decidedAt,
      submittedAt: current.submittedAt,
    });
    return { applied: true };
  }
}

/** Fixed-time Clock for deterministic decision timestamps. */
export function fixedClock(now: Date): Clock {
  return { now: () => now };
}
