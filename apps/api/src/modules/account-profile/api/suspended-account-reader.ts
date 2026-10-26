/**
 * FR-015 / OQ-015 / ADR-037: the account-lock facade.
 *
 * `admin-operation` composes its dashboard from published module facades rather than querying
 * another module's schema (ADR-014 forbids cross-schema SQL), so the lock list is answered here by
 * the module that owns `accounts`.
 *
 * **One read for both the count and the list.** The dashboard's `suspendedAccounts.total` and the
 * list endpoint must never disagree — that is the ADR-034 §7 invariant, and the cheapest way to
 * keep it is for both to come from this facade rather than for each caller to write its own
 * `COUNT(*)`.
 */

export const SUSPENDED_ACCOUNT_READER = Symbol('SuspendedAccountReader');

export interface SuspendedAccountSummary {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly reason: string;
  readonly suspendedBy: string | null;
  readonly suspendedAt: string;
}

/** Keyset cursor on `(suspendedAt, accountId)` descending. */
export interface SuspendedAccountCursor {
  readonly suspendedAt: Date;
  readonly accountId: string;
}

export interface SuspendedAccountPage {
  readonly items: readonly SuspendedAccountSummary[];
  readonly hasMore: boolean;
}

export interface SuspendedAccountReader {
  count(): Promise<number>;
  readPage(limit: number, cursor?: SuspendedAccountCursor): Promise<SuspendedAccountPage>;
}
