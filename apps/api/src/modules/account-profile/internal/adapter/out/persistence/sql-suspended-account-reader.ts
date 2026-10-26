import type {
  SuspendedAccountCursor,
  SuspendedAccountPage,
  SuspendedAccountReader,
  SuspendedAccountSummary,
} from '../../../../api/suspended-account-reader';
import type { AccountLockRepository } from '../../../application/port/out/account-repository';

/**
 * FR-015 / ADR-037 phase 3: answers the dashboard's lock questions from `account_profile`, the
 * schema that owns them.
 *
 * Reads **one extra row** beyond the page limit to decide `hasMore` instead of running a second
 * `COUNT(*)` — the count is already a separate call, and doing it twice per page would be two
 * chances for the two numbers to disagree.
 */
export class SqlSuspendedAccountReader implements SuspendedAccountReader {
  constructor(
    private readonly accounts: AccountLockRepository,
    private readonly moduleName: string,
  ) {}

  async count(): Promise<number> {
    return this.accounts.countSuspended();
  }

  async readPage(limit: number, cursor?: SuspendedAccountCursor): Promise<SuspendedAccountPage> {
    const rows = await this.accounts.listSuspended({ limit: limit + 1, cursor });
    const hasMore = rows.length > limit;
    const items: SuspendedAccountSummary[] = rows.slice(0, limit).map((row) => ({
      accountId: row.accountId,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      reason: row.reason,
      suspendedBy: row.suspendedBy,
      suspendedAt: row.suspendedAt,
    }));
    return { items, hasMore };
  }
}
