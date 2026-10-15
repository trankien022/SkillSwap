import { ListAdminVerificationsQueryHandler } from './list-admin-verifications.query';
import { InMemoryVerificationRepository } from './testing/verification-fakes';
import { DEFAULT_PAGE_LIMIT } from '@skillswap/contracts';
import { Verification } from '../domain/verification';

/**
 * FR-015 / NFR-014: the admin verification queue handler.
 *
 * The handler is a thin read, so what is worth pinning is the contract it honours: the default
 * limit, the wire view (shared with the owner-scoped read, so both describe a row identically),
 * the filters, and keyset paging that terminates.
 */

const AT = (day: number): Date => new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z`);

async function seed(
  repository: InMemoryVerificationRepository,
  rows: readonly {
    id: string;
    accountId: string;
    schoolName: string;
    status: 'pending' | 'approved' | 'rejected' | 'revoked';
    submittedAt: Date;
    decidedAt?: Date | null;
    reason?: string | null;
  }[],
): Promise<void> {
  for (const row of rows) {
    await repository.create({
      id: row.id,
      accountId: row.accountId,
      schoolName: row.schoolName,
      major: null,
      documentRef: `doc-${row.id}`,
      submittedAt: row.submittedAt,
    });
    if (row.status !== 'pending') {
      await repository.decide({
        verificationId: row.id,
        // The domain only accepts approved/rejected here; `revoked` is reached via revoke.
        status: row.status === 'revoked' ? 'approved' : row.status,
        reviewerId: 'admin-1',
        reason: row.reason ?? null,
        major: null,
        decidedAt: row.decidedAt ?? row.submittedAt,
      });
      if (row.status === 'revoked') {
        await repository.revoke({
          verificationId: row.id,
          reviewerId: 'admin-1',
          reason: 'revoked for test',
          revokedAt: row.decidedAt ?? row.submittedAt,
        });
      }
    }
  }
}

describe('ListAdminVerificationsQueryHandler', () => {
  it('applies the default page limit when none is given', async () => {
    const repository = new InMemoryVerificationRepository();
    const handler = new ListAdminVerificationsQueryHandler(repository);

    const page = await handler.execute({});

    expect(page.page.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(page.page.nextCursor).toBeNull();
  });

  it('maps rows through the same view the owner-scoped read uses', async () => {
    const repository = new InMemoryVerificationRepository();
    await seed(repository, [
      {
        id: 'v-1',
        accountId: 'acc-1',
        schoolName: 'Test University',
        status: 'approved',
        submittedAt: AT(1),
        decidedAt: AT(2),
      },
    ]);
    const handler = new ListAdminVerificationsQueryHandler(repository);

    const page = await handler.execute({});
    const expected = Verification.reconstitute({
      id: 'v-1',
      accountId: 'acc-1',
      schoolName: 'Test University',
      major: null,
      documentRef: 'doc-v-1',
      status: 'approved',
      reviewerId: 'admin-1',
      reason: null,
      decidedAt: AT(2),
      submittedAt: AT(1),
    });

    expect(Object.keys(page.items[0]).sort()).toEqual(
      Object.keys({
        id: '', status: '', schoolName: '', major: '', reviewerId: '', reason: '',
        decidedAt: '', submittedAt: '',
      }).sort(),
    );
    expect(page.items[0]).toMatchObject({
      id: 'v-1',
      status: expected.status,
      schoolName: 'Test University',
      decidedAt: AT(2).toISOString(),
      submittedAt: AT(1).toISOString(),
    });
  });

  it('filters by status', async () => {
    const repository = new InMemoryVerificationRepository();
    await seed(repository, [
      { id: 'p-1', accountId: 'a', schoolName: 'Alpha', status: 'pending', submittedAt: AT(1) },
      { id: 'a-1', accountId: 'b', schoolName: 'Beta', status: 'approved', submittedAt: AT(2) },
    ]);
    const handler = new ListAdminVerificationsQueryHandler(repository);

    const page = await handler.execute({ status: 'approved' });

    expect(page.items.map((item) => item.id)).toEqual(['a-1']);
    expect(page.page.total).toBe(1);
  });

  it('filters by school name', async () => {
    const repository = new InMemoryVerificationRepository();
    await seed(repository, [
      { id: 'v-1', accountId: 'a', schoolName: 'Hanoi University', status: 'pending', submittedAt: AT(1) },
      { id: 'v-2', accountId: 'b', schoolName: 'Saigon Tech', status: 'pending', submittedAt: AT(2) },
    ]);
    const handler = new ListAdminVerificationsQueryHandler(repository);

    const page = await handler.execute({ q: 'hanoi' });

    expect(page.items.map((item) => item.id)).toEqual(['v-1']);
  });

  it('pages with a cursor that terminates', async () => {
    const repository = new InMemoryVerificationRepository();
    await seed(
      repository,
      [1, 2, 3].map((day) => ({
        id: `v-${day}`,
        accountId: `acc-${day}`,
        schoolName: `School ${day}`,
        status: 'pending' as const,
        submittedAt: AT(day),
      })),
    );
    const handler = new ListAdminVerificationsQueryHandler(repository);

    const first = await handler.execute({ limit: 2 });
    expect(first.items.map((item) => item.id)).toEqual(['v-1', 'v-2']);
    expect(first.page.total).toBe(3);
    expect(first.page.nextCursor).not.toBeNull();

    const second = await handler.execute({ limit: 2, cursor: first.page.nextCursor ?? undefined });
    expect(second.items.map((item) => item.id)).toEqual(['v-3']);
    // The last page reports no further cursor, so a client paging until null terminates.
    expect(second.page.nextCursor).toBeNull();
    expect(second.page.total).toBe(3);
  });
  it('sorts newest-first when asked', async () => {
    const repository = new InMemoryVerificationRepository();
    await seed(
      repository,
      [1, 2].map((day) => ({
        id: `v-${day}`,
        accountId: `acc-${day}`,
        schoolName: `School ${day}`,
        status: 'pending' as const,
        submittedAt: AT(day),
      })),
    );
    const handler = new ListAdminVerificationsQueryHandler(repository);

    const page = await handler.execute({ sort: '-submittedAt' });

    expect(page.items.map((item) => item.id)).toEqual(['v-2', 'v-1']);
  });

  it('returns an empty page when nothing matches', async () => {
    const repository = new InMemoryVerificationRepository();
    const handler = new ListAdminVerificationsQueryHandler(repository);

    const page = await handler.execute({ status: 'revoked' });

    expect(page.items).toEqual([]);
    expect(page.page.total).toBe(0);
    expect(page.page.nextCursor).toBeNull();
  });
});
