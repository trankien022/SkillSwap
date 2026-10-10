/**
 * FR-004 / ADR-027: the Verifier and its authority model.
 *
 * A Verifier is an account with a **seeded expertise set** of skills drawn from the
 * ADR-026 `category → skill` catalogue. There is **no admin assignment** and no
 * self-service: expertise is provisioned operationally. A Verifier may hold several
 * skills; an evidence request's skill must be in their set for them to see, claim and
 * decide it. A Verifier may never decide their own evidence (BR-012), and an
 * Administrator role alone grants no review right (BR-065).
 *
 * Framework-free: no NestJS, no TypeORM.
 */

export const VERIFIER_STATUSES = ['active', 'suspended', 'revoked'] as const;
export type VerifierStatus = (typeof VERIFIER_STATUSES)[number];

export const INITIAL_VERIFIER_STATUS: VerifierStatus = 'active';

export const VERIFIER_EVENTS = {
  suspended: 'skill.verifier.suspended',
  revoked: 'skill.verifier.revoked',
} as const;

export class UnknownVerifierStatusError extends Error {
  constructor(status: string) {
    super(`Unknown verifier status: ${status}`);
    this.name = 'UnknownVerifierStatusError';
  }
}

export class UnknownVerifierError extends Error {
  constructor(verifierId: string) {
    super(`Unknown verifier: ${verifierId}`);
    this.name = 'UnknownVerifierError';
  }
}

export class InactiveVerifierError extends Error {
  constructor(verifierId: string, status: VerifierStatus) {
    super(`Verifier ${verifierId} is ${status} and cannot review`);
    this.name = 'InactiveVerifierError';
  }
}

export class OutOfExpertiseError extends Error {
  constructor(verifierId: string, skillId: string) {
    super(`Verifier ${verifierId} has no expertise in skill ${skillId}`);
    this.name = 'OutOfExpertiseError';
  }
}

export class SelfDecisionError extends Error {
  constructor(verifierId: string) {
    super(`Verifier ${verifierId} cannot decide their own evidence`);
    this.name = 'SelfDecisionError';
  }
}

export class NotAVerifierError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} is not a Verifier`);
    this.name = 'NotAVerifierError';
  }
}

export class InvalidVerifierTransitionError extends Error {
  constructor(from: VerifierStatus, to: VerifierStatus) {
    super(`Illegal verifier transition: ${from} -> ${to}`);
    this.name = 'InvalidVerifierTransitionError';
  }
}

export function isVerifierStatus(value: string): value is VerifierStatus {
  return (VERIFIER_STATUSES as readonly string[]).includes(value);
}

export function assertVerifierStatus(value: string): asserts value is VerifierStatus {
  if (!isVerifierStatus(value)) {
    throw new UnknownVerifierStatusError(value);
  }
}

const TRANSITIONS: Readonly<Record<VerifierStatus, readonly VerifierStatus[]>> = {
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],
};

/** FR-004: a suspended/revoked Verifier may be reactivated unless revoked. */
export function canChangeVerifierStatus(from: VerifierStatus, to: VerifierStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertVerifierTransition(from: VerifierStatus, to: VerifierStatus): void {
  if (!canChangeVerifierStatus(from, to)) {
    throw new InvalidVerifierTransitionError(from, to);
  }
}

export interface Verifier {
  readonly accountId: string;
  readonly status: VerifierStatus;
  /** FR-004 / ADR-027: the seeded skills this Verifier is competent to review. */
  readonly expertise: readonly string[];
}

/** Whether the Verifier's expertise set covers a skill. */
export function hasExpertise(verifier: Pick<Verifier, 'expertise'>, skillId: string): boolean {
  return verifier.expertise.includes(skillId);
}

/**
 * FR-004 / AC-018: whether a Verifier may see/claim/decide an evidence request.
 * True only when the Verifier is `active`, holds expertise for the evidence's skill,
 * and is not the owner of the evidence. An Administrator role is irrelevant here.
 */
export function mayDecide(
  verifier: Pick<Verifier, 'accountId' | 'status' | 'expertise'>,
  evidence: { skillId: string; ownerId: string },
): boolean {
  return (
    verifier.status === 'active' &&
    hasExpertise(verifier, evidence.skillId) &&
    verifier.accountId !== evidence.ownerId
  );
}

/**
 * Asserts the full authority to decide, throwing the specific error for the failed
 * clause (order: active → expertise → not-owner), so AC-018 branches are testable.
 */
export function assertMayDecide(
  verifier: Pick<Verifier, 'accountId' | 'status' | 'expertise'>,
  evidence: { skillId: string; ownerId: string },
): void {
  if (verifier.status !== 'active') {
    throw new InactiveVerifierError(verifier.accountId, verifier.status);
  }
  if (!hasExpertise(verifier, evidence.skillId)) {
    throw new OutOfExpertiseError(verifier.accountId, evidence.skillId);
  }
  if (verifier.accountId === evidence.ownerId) {
    throw new SelfDecisionError(verifier.accountId);
  }
}

/** FR-004: whether a verifier administratively controls a target status change. */
export function mayChangeStatus(
  from: VerifierStatus,
  to: VerifierStatus,
): boolean {
  return canChangeVerifierStatus(from, to);
}
