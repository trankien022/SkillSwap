import { SqlSuspendedAccountReader } from './sql-suspended-account-reader';
import type { AccountLockRepository, LockedAccountRecord } from '../../../application/port/out/account-repository';

/**
 * FR-015 / ADR-037: the facade the dashboard composes from.
 *
 * The behaviour worth pinning is the peek-ahead: `hasMore` must come from the extra row, not from
 * a second count, so the page and the total cannot drift.
 */

function record(accountId: string, suspendedAt: string): LockedAccountRecord {
  return {
    accountId,
    email: `${accountId}@skillswap.test`,
    displayName: 'Locked',
    role: 'user',
    reason: 'Repeated payment fraud',
    suspendedBy: '8a1e0000-0000-4000-8000-0000000000a1',
    suspendedAt,
  };
}

const A = '7c1e0000-0000-4000-8000-0000000000b1';
const B = '7c1e0000-0000-4000-8000-0000000000b2';

function repository(rows: LockedAccountRecord[], total: number) {
  const queries: { limit: number; cursor?: unknown }[] = [];
  const fake = {
    changeStatus: jest.fn(),
    countSuspended: jest.fn().mockResolvedValue(total),
    listSuspended: jest.fn(async (query: { limit: number; cursor?: unknown }) => {
      queries.push(query);
      return rows.slice(0, query.limit);
    }),
  } as unknown as AccountLockRepository;
  return { fake, queries };
}

describe('SqlSuspendedAccountReader (FR-015 / ADR-037)', () => {
  it('counts through the owning repository', async () => {
    const { fake } = repository([], 4);
    const reader = new SqlSuspendedAccountReader(fake, 'account-profile');

    await expect(reader.count()).resolves.toBe(4);
    expect(fake.countSuspended).toHaveBeenCalledTimes(1);
  });

  it('trims the peek-ahead row and reports hasMore', async () => {
    const { fake, queries } = repository([record(A, '2026-10-26T09:00:00.000Z'), record(B, '2026-10-25T09:00:00.000Z')], 2);
    const reader = new SqlSuspendedAccountReader(fake, 'account-profile');

    const page = await reader.readPage(1);

    // Asked for `limit + 1`, so one row is left over.
    expect(queries[0]?.limit).toBe(2);
    expect(page.hasMore).toBe(true);
    expect(page.items.map((item) => item.accountId)).toEqual([A]);
  });

  it('reports no more when the peek-ahead finds nothing extra', async () => {
    const { fake } = repository([record(A, '2026-10-26T09:00:00.000Z')], 1);
    const reader = new SqlSuspendedAccountReader(fake, 'account-profile');

    const page = await reader.readPage(5);

    expect(page.hasMore).toBe(false);
    expect(page.items).toHaveLength(1);
  });

  it('passes the cursor through untouched', async () => {
    const { fake, queries } = repository([], 0);
    const reader = new SqlSuspendedAccountReader(fake, 'account-profile');
    const cursor = { suspendedAt: new Date('2026-10-26T09:00:00.000Z'), accountId: A };

    await reader.readPage(3, cursor);

    expect(queries[0]?.cursor).toEqual(cursor);
  });

  it('maps each row to the public shape', async () => {
    const { fake } = repository([record(A, '2026-10-26T09:00:00.000Z')], 1);
    const reader = new SqlSuspendedAccountReader(fake, 'account-profile');

    const page = await reader.readPage(5);

    expect(page.items[0]).toEqual({
      accountId: A,
      email: `${A}@skillswap.test`,
      displayName: 'Locked',
      role: 'user',
      reason: 'Repeated payment fraud',
      suspendedBy: '8a1e0000-0000-4000-8000-0000000000a1',
      suspendedAt: '2026-10-26T09:00:00.000Z',
    });
  });
});
