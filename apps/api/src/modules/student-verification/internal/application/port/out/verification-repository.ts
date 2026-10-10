import type { Verification, VerificationStatus } from '../../../domain/verification';

export const VERIFICATION_REPOSITORY = Symbol('VerificationRepository');

/** Fields needed to create a new (pending) verification row. */
export interface CreateVerificationRequest {
  readonly id: string;
  readonly accountId: string;
  readonly schoolName: string;
  readonly major: string | null;
  readonly documentRef: string;
  readonly submittedAt: Date;
}

/** The decision fields applied to a pending verification. */
export interface ApplyDecisionRequest {
  readonly verificationId: string;
  readonly status: Extract<VerificationStatus, 'approved' | 'rejected'>;
  readonly reviewerId: string;
  readonly reason: string | null;
  readonly major: string | null;
  readonly decidedAt: Date;
  readonly expiresAt: Date | null;
}

export interface ApplyDecisionResult {
  /** False when the row was not pending anymore (already decided). */
  readonly applied: boolean;
}

export interface VerificationRepository {
  /** Inserts a pending verification, rejecting a second effective one. */
  create(request: CreateVerificationRequest): Promise<Verification>;
  /** The account's current effective verification (pending|approved), if any. */
  findEffective(accountId: string): Promise<Verification | null>;
  /** The account's most recent verification (any status) for the owner view. */
  findLatestByAccount(accountId: string): Promise<Verification | null>;
  findById(verificationId: string): Promise<Verification | null>;
  /**
   * Applies an Administrator decision to a pending verification and writes the
   * matching outbox event in the same transaction (ADR-013). A decision on a
   * non-pending row is a no-op.
   */
  decide(request: ApplyDecisionRequest): Promise<ApplyDecisionResult>;
}
