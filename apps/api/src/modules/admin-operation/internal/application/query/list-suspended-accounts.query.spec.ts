import type {
  SuspendedAccountCursor,
  SuspendedAccountPage,
  SuspendedAccountReader,
} from '../../../../account-profile/api';
import { ListSuspendedAccountsQueryHandler, toSuspendedCursor } from './list-suspended-accounts.query';

const T0 = '2026-10-26T09:00:00.000Z';
const T1 = '2026-10-25T09:00:00.000Z';

function row(accountId: string, suspendedAt: string) {
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

function reader(pages: Map<string, SuspendedAccountPage>, total: number) {
  const calls: { limit: number; cursor?: SuspendedAccountCursor }[] = [];
  const fake: SuspendedAccountReader = {
    count: jest.fn().mockResolvedValue(total),
    readPage: jest.fn(async (limit: number, cursor?: SuspendedAccountCursor) => {
      calls.push({ limit, cursor });
      return pages.get(cursor?.accountId ?? 'first') ?? { items: [], hasMore: false };
    }),
  };
  return { fake, calls };
}

const A = '7c1e0000-0000-4000-8000-0000000000b1';
const B = '7c1e0000-0000-4000-8000-0000000000b2';

describe('ListSuspendedAccountsQueryHandler (FR-015 / ADR-037)', () => {
  it('reports the total from the same source as the page (ADR-034 §7 invariant)', async () => {
    const { fake } = reader(
      new Map([['first', { items: [row(A, T0)], hasMore: false }]]),
      // Deliberately larger than the page: `total` describes the whole list, not the slice.
      7,
    );
    const handler = new ListSuspendedAccountsQueryHandler(fake);

    const result = await handler.execute({ limit: 20 });

    expect(result.page.total).toBe(7);
    expect(result.items).toHaveLength(1);
    expect(result.page.limit).toBe(20);
    expect(fake.count).toHaveBeenCalledTimes(1);
  });

  it('defaults the limit when the caller sends none', async () => {
    const { fake, calls } = reader(new Map([['first', { items: [], hasMore: false }]]), 0);
    const handler = new ListSuspendedAccountsQueryHandler(fake);

    const result = await handler.execute({});

    expect(calls[0]?.limit).toBe(20);
    expect(result.page.limit).toBe(20);
  });

  it('asks for one row beyond the limit, so `hasMore` costs no second count', async () => {
    const { fake, calls } = reader(new Map([['first', { items: [], hasMore: false }]]), 3);
    const handler = new ListSuspendedAccountsQueryHandler(fake);

    await handler.execute({ limit: 5 });

    // The facade does the +1; the handler must not do it too.
    expect(calls[0]?.limit).toBe(5);
  });

  it('emits next-cursor parts naming the last row', async () => {
    const { fake } = reader(
      new Map([['first', { items: [row(A, T0), row(B, T1)], hasMore: true }]]),
      4,
    );
    const handler = new ListSuspendedAccountsQueryHandler(fake);

    const result = await handler.execute({ limit: 2 });

    // Parts, not an encoded string: ADR-009 keeps base64 in the web adapter.
    expect(result.page.nextCursor).toEqual([String(new Date(T1).getTime()), B]);
    expect(toSuspendedCursor(result.page.nextCursor ?? undefined)).toEqual({
      suspendedAt: new Date(T1),
      accountId: B,
    });
  });

  it('has no next cursor on the last page', async () => {
    const { fake } = reader(new Map([['first', { items: [row(A, T0)], hasMore: false }]]), 1);
    const handler = new ListSuspendedAccountsQueryHandler(fake);

    expect((await handler.execute({ limit: 20 })).page.nextCursor).toBeNull();
  });

  it('resumes from the cursor the previous page handed out', async () => {
    const { fake, calls } = reader(
      new Map([
        ['first', { items: [row(A, T0)], hasMore: true }],
        [A, { items: [row(B, T1)], hasMore: false }],
      ]),
      2,
    );
    const handler = new ListSuspendedAccountsQueryHandler(fake);

    const first = await handler.execute({ limit: 1 });
    const second = await handler.execute({ limit: 1, cursor: first.page.nextCursor ?? undefined });

    expect(calls[1]?.cursor).toEqual({ suspendedAt: new Date(T0), accountId: A });
    expect(second.items.map((item) => item.accountId)).toEqual([B]);
    // No duplicates across the boundary — the property keyset paging exists to give.
    expect(second.items.map((item) => item.accountId)).not.toContain(A);
  });
});

describe('toSuspendedCursor', () => {
  it('returns null for absent input', () => {
    expect(toSuspendedCursor(undefined)).toBeNull();
  });

  it('returns null for the wrong number of parts rather than throwing at the page boundary', () => {
    expect(toSuspendedCursor([])).toBeNull();
    expect(toSuspendedCursor(['only-one'])).toBeNull();
    expect(toSuspendedCursor(['1', A, 'extra'])).toBeNull();
  });

  it('returns null when the timestamp part is not a number', () => {
    expect(toSuspendedCursor(['abc', A])).toBeNull();
  });

  it('returns null when the account id part is empty', () => {
    expect(toSuspendedCursor(['1', ''])).toBeNull();
  });
});
