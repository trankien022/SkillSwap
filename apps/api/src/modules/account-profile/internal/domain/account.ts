/** Account aggregate for FR-001 (ADR-016: local accounts owned by this module). */

export const ACCOUNT_ROLES = ['user', 'verifier', 'admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** FR-001 / ADR-030: the only role a public user may create at self-registration. */
export const SELF_REGISTRATION_ROLES = ['user'] as const;
export type SelfRegistrationRole = (typeof SELF_REGISTRATION_ROLES)[number];

export function isSelfRegistrationRole(value: string): value is SelfRegistrationRole {
  return (SELF_REGISTRATION_ROLES as readonly string[]).includes(value);
}

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const INITIAL_ACCOUNT_STATUS: AccountStatus = 'active';

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AccountRole;
  readonly status: AccountStatus;
  readonly createdAt: string;
  /**
   * FR-015 / OQ-015 / ADR-037: an admin-initiated suspension carries a required reason and the
   * account that applied it. Present only while `status === 'suspended'`; a lock is an extension of
   * the status that already existed, not a second condition.
   */
  readonly suspension?: AccountSuspension;
}

export interface AccountSuspension {
  readonly reason: string;
  /** The Administrator who applied it; `null` only for a suspension with no recorded actor. */
  readonly suspendedBy: string | null;
  readonly suspendedAt: string;
}

/**
 * ADR-037 decision 2: a suspension without a reason cannot be told apart from a bug, and the
 * Administrator who applied it could not be held to account for it. Validated in the domain so
 * every entry point (REST today, anything later) inherits the rule.
 */
export function assertSuspensionReason(reason: string): void {
  if (reason.trim() === '') {
    throw new InvalidSuspensionReasonError();
  }
}

export class InvalidSuspensionReasonError extends Error {
  constructor() {
    super('A suspension requires a reason');
    this.name = 'InvalidSuspensionReasonError';
  }
}

/**
 * ADR-037 decision 2: a reason is meaningless when reactivating, and is rejected rather than
 * silently dropped — an ignored field is how a caller comes to believe it recorded something.
 */
export class InvalidReactivationReasonError extends Error {
  constructor() {
    super('Reactivating an account does not take a reason');
    this.name = 'InvalidReactivationReasonError';
  }
}

export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`An account already exists for ${email}`);
    this.name = 'EmailTakenError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountSuspendedError extends Error {
  constructor() {
    super('This account is suspended');
    this.name = 'AccountSuspendedError';
  }
}

export class AccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Account not found: ${id}`);
    this.name = 'AccountNotFoundError';
  }
}

export function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value);
}

export function assertAccountRole(value: string): asserts value is AccountRole {
  if (!isAccountRole(value)) {
    throw new InvalidAccountRoleError(value);
  }
}

export class InvalidAccountRoleError extends Error {
  constructor(value: string) {
    super(`Unknown account role: ${value}`);
    this.name = 'InvalidAccountRoleError';
  }
}

/** Emails are compared case-insensitively (uniqueness and sign-in). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertAccountCanSignIn(status: AccountStatus): void {
  if (status !== 'active') {
    throw new AccountSuspendedError();
  }
}
