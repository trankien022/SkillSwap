import type { AccountStatus } from '../../../domain/account';

/**
 * FR-015 / OQ-015 / ADR-037: an Administrator changes an account's status.
 *
 * `actorId` is the Administrator (ADR-035). `accountId` is the account being changed. The two are
 * different accounts and the audit row must never attribute the act to its subject.
 */
export interface LockAccountCommand {
  readonly accountId: string;
  readonly status: AccountStatus;
  /** Required when suspending; ignored when reactivating. */
  readonly reason: string | null;
  readonly actorId: string;
}

export interface LockAccountResult {
  readonly accountId: string;
  readonly status: AccountStatus;
  readonly changed: boolean;
  readonly reason: string | null;
}

export const LOCK_ACCOUNT_PORT = Symbol('LockAccountPort');

export interface LockAccountPort {
  execute(command: LockAccountCommand): Promise<LockAccountResult>;
}
