import type { AccountVerificationStatus } from '@skillswap/contracts';

export const VERIFICATION_STATUS_READER = Symbol('VerificationStatusReader');
export const VERIFICATION_STATUS_WRITER = Symbol('VerificationStatusWriter');

/** The projected verification summary for an account (FR-017 / ADR-024). */
export interface ProjectedVerificationStatus {
  readonly status: AccountVerificationStatus;
  readonly reason: string | null;
}

export interface VerificationStatusReader {
  /** Null when the account never submitted a verification. */
  findByAccount(accountId: string): Promise<ProjectedVerificationStatus | null>;
}

/** Fields the consumer applies from a `student.verification.*` event. */
export interface UpsertVerificationStatusRequest {
  readonly accountId: string;
  readonly verificationId: string;
  readonly status: AccountVerificationStatus;
  readonly reason: string | null;
  readonly occurredAt: string;
}

export interface VerificationStatusWriter {
  /** Idempotently upserts the projection; an older event never overwrites a newer one. */
  upsert(request: UpsertVerificationStatusRequest): Promise<void>;
}
