import { DEFAULT_PAGE_LIMIT } from '@skillswap/contracts';
import type { SuspendedAccountReader } from '../../../../account-profile/api';
import type {
  ListSuspendedAccountsPort,
  ListSuspendedAccountsQuery,
  SuspendedAccountsPageWithCursorParts,
} from '../port/in/list-suspended-accounts';

/**
 * FR-015 / OQ-015 / ADR-037 phase 3: the account-lock list.
 *
 * **The count and the page come from the same source** (the `SuspendedAccountReader` facade), so
 * `page.total` always describes the list it is attached to — the ADR-034 §7 invariant. That is why
 * both calls are made here rather than the controller assembling one of them.
 *
 * Keyset, not offset (NFR-014): a suspension applied between two page loads must not shift a row
 * the caller has already seen onto the next page. The sort is `(suspended_at, id)` descending, so
 * the cursor carries exactly those two parts — as **raw parts**, because base64-encoding a cursor is
 * a transport concern and ADR-009 forbids the application layer from reaching into `shared/http`.
 * The controller decodes the query cursor and encodes the next one.
 */
export class ListSuspendedAccountsQueryHandler implements ListSuspendedAccountsPort {
  constructor(private readonly accounts: SuspendedAccountReader) {}

  async execute(query: ListSuspendedAccountsQuery): Promise<SuspendedAccountsPageWithCursorParts> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = toSuspendedCursor(query.cursor);
    const [page, total] = await Promise.all([
      this.accounts.readPage(limit, cursor ?? undefined),
      this.accounts.count(),
    ]);
    const last = page.items[page.items.length - 1];
    return {
      items: page.items.map((row) => ({ ...row })),
      page: {
        limit,
        total,
        // `readPage` asked for one row more than the limit to decide `hasMore`.
        nextCursor:
          page.hasMore && last !== undefined
            ? [String(new Date(last.suspendedAt).getTime()), last.accountId]
            : null,
      },
    };
  }
}

/**
 * Turns the decoded cursor parts into the reader's `(suspendedAt, accountId)` pair, or `null` for
 * absent **or malformed** input so the handler treats it as "first page" rather than failing.
 */
export function toSuspendedCursor(
  parts: readonly string[] | undefined,
): { readonly suspendedAt: Date; readonly accountId: string } | null {
  if (parts === undefined || parts.length !== 2) {
    return null;
  }
  const millis = Number(parts[0]);
  const accountId = parts[1];
  if (!Number.isFinite(millis) || accountId === undefined || accountId.length === 0) {
    return null;
  }
  return { suspendedAt: new Date(millis), accountId };
}
