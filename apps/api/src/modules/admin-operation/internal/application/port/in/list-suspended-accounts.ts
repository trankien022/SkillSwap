import type { SuspendedAccountsPage } from '@skillswap/contracts';

export const LIST_SUSPENDED_ACCOUNTS = Symbol('ListSuspendedAccountsPort');

/** FR-015 / OQ-015 / ADR-037: the admin-initiated account-lock list. */
export interface ListSuspendedAccountsQuery {
  readonly limit?: number;
  /**
   * The cursor **parts**, already decoded by the web adapter (`[suspendedAtMillis, accountId]`).
   * Absent means "first page"; the adapter drops a malformed cursor rather than failing the request.
   */
  readonly cursor?: readonly string[];
  /** Closed to `suspended`; the route answers nothing else (see the contract). */
  readonly status?: 'suspended';
}

export interface ListSuspendedAccountsPort {
  execute(query: ListSuspendedAccountsQuery): Promise<SuspendedAccountsPageWithCursorParts>;
}

/** The page as the handler produces it: `nextCursor` still split into parts, not yet encoded. */
export interface SuspendedAccountsPageWithCursorParts extends Omit<SuspendedAccountsPage, 'page'> {
  readonly page: Omit<SuspendedAccountsPage['page'], 'nextCursor'> & {
    readonly nextCursor: readonly string[] | null;
  };
}
