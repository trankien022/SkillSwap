/**
 * FR-002 / ADR-023 + FR-019 / ADR-025: the Student verification aggregate.
 *
 * A Learner submits a school name plus an uploaded document (`documentRef` = the
 * object key); an Administrator approves or rejects with a reason. At most one
 * verification is "effective" (pending or approved) per account (SR-BR-011).
 * Approval does not expire in the MVP (developer decision); an Administrator may
 * revoke it, which demotes rights (cascade, no grandfather). Framework-free: no
 * NestJS, no TypeORM.
 */

export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected', 'revoked'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Statuses that count as the account's current verification (SR-BR-011). */
export const EFFECTIVE_STATUSES = ['pending', 'approved'] as const;
export type EffectiveStatus = (typeof EFFECTIVE_STATUSES)[number];

export const INITIAL_VERIFICATION_STATUS: VerificationStatus = 'pending';

export const VERIFICATION_EVENTS = {
  submitted: 'student.verification.submitted',
  approved: 'student.verification.approved',
  rejected: 'student.verification.rejected',
  revoked: 'student.verification.revoked',
} as const;

export function isVerificationStatus(value: string): value is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export function assertVerificationStatus(value: string): asserts value is VerificationStatus {
  if (!isVerificationStatus(value)) {
    throw new UnknownVerificationStatusError(value);
  }
}

export function isEffectiveStatus(status: VerificationStatus): status is EffectiveStatus {
  return (EFFECTIVE_STATUSES as readonly string[]).includes(status);
}

export class UnknownVerificationStatusError extends Error {
  constructor(status: string) {
    super(`Unknown verification status: ${status}`);
    this.name = 'UnknownVerificationStatusError';
  }
}

export class InvalidVerificationTransitionError extends Error {
  constructor(from: VerificationStatus, to: VerificationStatus) {
    super(`Illegal verification transition: ${from} -> ${to}`);
    this.name = 'InvalidVerificationTransitionError';
  }
}

export class ReasonRequiredError extends Error {
  constructor(action = 'rejection') {
    super(`A ${action} requires a non-empty reason`);
    this.name = 'ReasonRequiredError';
  }
}

export class DuplicateActiveVerificationError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} already has an effective verification`);
    this.name = 'DuplicateActiveVerificationError';
  }
}

export class InvalidDeciderError extends Error {
  constructor(deciderId: string) {
    super(`Account ${deciderId} is not an Administrator`);
    this.name = 'InvalidDeciderError';
  }
}

export class InvalidRevocationError extends Error {
  constructor(status: VerificationStatus) {
    super(`A ${status} verification cannot be revoked`);
    this.name = 'InvalidRevocationError';
  }
}

const TRANSITIONS: Readonly<Record<VerificationStatus, readonly VerificationStatus[]>> = {
  pending: ['approved', 'rejected', 'revoked'],
  approved: ['revoked'],
  rejected: [],
  revoked: [],
};

export function canDecide(
  from: VerificationStatus,
  to: VerificationStatus,
): to is 'approved' | 'rejected' {
  return TRANSITIONS[from].includes(to);
}

export function assertDecidable(from: VerificationStatus, to: VerificationStatus): void {
  if (!canDecide(from, to)) {
    throw new InvalidVerificationTransitionError(from, to);
  }
}

/** FR-019 / ADR-025: only `approved` grants `VERIFIED` rights; revoked does not. */
export function hasVerifiedRights(status: VerificationStatus): boolean {
  return status === 'approved';
}

/** Whether a verification can be revoked (only an effective one can). */
export function canRevoke(status: VerificationStatus): boolean {
  return TRANSITIONS[status].includes('revoked');
}

export interface VerificationDecision {
  status: Extract<VerificationStatus, 'approved' | 'rejected'>;
  reason?: string;
  major?: string;
  decidedAt: Date;
  reviewerId: string;
}

export class Verification {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly schoolName: string,
    readonly major: string | null,
    readonly documentRef: string,
    readonly status: VerificationStatus,
    readonly reviewerId: string | null,
    readonly reason: string | null,
    readonly decidedAt: Date | null,
    readonly submittedAt: Date,
    readonly revokedAt: Date | null = null,
    readonly revocationReason: string | null = null,
  ) {}

  static submit(input: {
    id: string;
    accountId: string;
    schoolName: string;
    major?: string | null;
    documentRef: string;
    submittedAt: Date;
  }): Verification {
    const schoolName = input.schoolName.trim();
    if (schoolName.length === 0) {
      throw new RangeError('schoolName must not be empty');
    }
    if (input.documentRef.trim().length === 0) {
      throw new RangeError('documentRef must not be empty');
    }
    return new Verification(
      input.id,
      input.accountId,
      schoolName,
      input.major?.trim() || null,
      input.documentRef,
      INITIAL_VERIFICATION_STATUS,
      null,
      null,
      null,
      input.submittedAt,
    );
  }

  /** Rehydrates a persisted verification (used by the repository adapter). */
  static reconstitute(input: {
    id: string;
    accountId: string;
    schoolName: string;
    major: string | null;
    documentRef: string;
    status: VerificationStatus;
    reviewerId: string | null;
    reason: string | null;
    decidedAt: Date | null;
    submittedAt: Date;
    revokedAt?: Date | null;
    revocationReason?: string | null;
  }): Verification {
    assertVerificationStatus(input.status);
    return new Verification(
      input.id,
      input.accountId,
      input.schoolName,
      input.major,
      input.documentRef,
      input.status,
      input.reviewerId,
      input.reason,
      input.decidedAt,
      input.submittedAt,
      input.revokedAt ?? null,
      input.revocationReason ?? null,
    );
  }

  get isEffective(): boolean {
    return isEffectiveStatus(this.status);
  }

  /** FR-019: whether this verification currently grants `VERIFIED` rights. */
  get hasVerifiedRights(): boolean {
    return hasVerifiedRights(this.status);
  }

  /** Owner-facing reason to show: the rejection or revocation reason. */
  get displayReason(): string | null {
    return this.status === 'revoked' ? this.revocationReason : this.reason;
  }
}

/**
 * Applies an Administrator decision to a pending verification. Rejection
 * requires a reason (AC-012). Approval does not expire in the MVP (ADR-023).
 */
export function decideVerification(
  status: VerificationStatus,
  decision: {
    decision: 'approve' | 'reject';
    reason?: string;
    major?: string;
  },
  context: { reviewerRole: string | undefined; reviewerId: string; now: Date },
): VerificationDecision {
  if (context.reviewerRole !== 'admin') {
    throw new InvalidDeciderError(context.reviewerId);
  }
  const target = decision.decision === 'approve' ? 'approved' : 'rejected';
  assertDecidable(status, target);

  if (target === 'rejected') {
    const reason = decision.reason?.trim();
    if (!reason) {
      throw new ReasonRequiredError();
    }
    return {
      status: 'rejected',
      reason,
      decidedAt: context.now,
      reviewerId: context.reviewerId,
    };
  }

  return {
    status: 'approved',
    major: decision.major?.trim() || undefined,
    decidedAt: context.now,
    reviewerId: context.reviewerId,
  };
}

export interface VerificationRevocation {
  status: 'revoked';
  reason: string;
  revokedAt: Date;
}

/**
 * FR-019 / ADR-025: revokes an effective verification. Requires the admin role
 * and a reason; only `pending`/`approved` can be revoked.
 */
export function revokeVerification(
  status: VerificationStatus,
  input: { reason?: string },
  context: { reviewerRole: string | undefined; reviewerId: string; now: Date },
): VerificationRevocation {
  if (context.reviewerRole !== 'admin') {
    throw new InvalidDeciderError(context.reviewerId);
  }
  if (!canRevoke(status)) {
    throw new InvalidRevocationError(status);
  }
  const reason = input.reason?.trim();
  if (!reason) {
    throw new ReasonRequiredError('revocation');
  }
  return { status: 'revoked', reason, revokedAt: context.now };
}
