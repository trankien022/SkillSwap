import type { Account, AccountRole, AccountStatus } from '../../../domain/account';

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');
export const ACCOUNT_LOCK_REPOSITORY = Symbol('AccountLockRepository');

export interface NewAccount {
  readonly email: string;
  readonly displayName: string;
  readonly role: AccountRole;
  readonly status: AccountStatus;
}

export interface AccountRepository {
  create(input: NewAccount): Promise<Account>;
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
}

/**
 * FR-015 / OQ-015 / ADR-037.
 *
 * A separate port from `AccountRepository` on purpose: reading an account and *locking* one are
 * different capabilities, and the dashboard module should be able to depend on the read side
 * without being able to suspend anyone. Same adapter implements both.
 */
export interface ChangeAccountStatusCommand {
  readonly accountId: string;
  readonly status: AccountStatus;
  /** Required when `status === 'suspended'` (ADR-037 decision 2); ignored otherwise. */
  readonly reason: string | null;
  /** ADR-035: the Administrator who acted, never the account being changed. */
  readonly actorId: string;
  readonly occurredAt: Date;
}

/** FR-015 / ADR-037 phase 3: one row of the account-lock list, owner-agnostic. */
export interface LockedAccountRecord {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly reason: string;
  readonly suspendedBy: string | null;
  readonly suspendedAt: string;
}

/** Keyset cursor: `(suspended_at, id)` descending. */
export interface AccountLockCursor {
  readonly suspendedAt: Date;
  readonly accountId: string;
}

export interface AccountLockListQuery {
  readonly limit: number;
  readonly cursor?: AccountLockCursor;
}

export interface AccountLockRepository {
  /**
   * Returns `null` when the account does not exist. `changed` is `false` when it was already in the
   * requested status — in that case nothing was written and no event was emitted.
   */
  changeStatus(
    command: ChangeAccountStatusCommand,
  ): Promise<{ readonly account: Account; readonly changed: boolean } | null>;
  listSuspended(query: AccountLockListQuery): Promise<LockedAccountRecord[]>;
  countSuspended(): Promise<number>;
}

export type { Account };
