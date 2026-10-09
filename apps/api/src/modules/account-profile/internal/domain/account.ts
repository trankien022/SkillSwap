/** Account aggregate for FR-001 (ADR-016: local accounts owned by this module). */

export const ACCOUNT_ROLES = ['learner', 'teacher', 'admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

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
