import { SqlVerificationRepository } from './sql-verification-repository';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { InvalidCursorError } from '../../../../../../shared/errors';
import { encodeCursor } from '../../../../../../shared/http/keyset-cursor';
import type { AdminVerificationSort } from '../../../application/port/out/verification-repository';

/**
 * FR-015 / NFR-014: the admin verification queue's SQL adapter.
 *
 * These pin the properties the plan calls out: the page and its `COUNT(*)` are issued together
 * (so `total` describes the same row set as `items`), only whitelisted sorts reach SQL, filters
 * are parameterised, and a cursor that cannot be honoured is refused rather than ignored.
 */

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

function createRecordingRegistry(responses: unknown[]) {
  const recordedQueries: RecordedQuery[] = [];
  const queue = [...responses];

  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    if (queue.length === 0) {
      throw new Error(`Unexpected query: ${sql}`);
    }
    const next = queue.shift();
    if (typeof next === 'function') {
      return (next as (sql: string, params?: unknown[]) => unknown)(sql, params);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });

  const dataSource = { query: mockQuery };
  const registry = {
    getSchema: jest.fn(() => 'student_verification'),
    get: jest.fn(() => dataSource),
  } as unknown as ModuleDataSourceRegistry;

  return { registry, recordedQueries };
}

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'v-1',
    account_id: 'acc-1',
    school_name: 'Test University',
    major: null,
    document_ref: 'doc-1',
    status: 'pending',
    reviewer_id: null,
    reason: null,
    decided_at: null,
    created_at: new Date('2026-10-01T00:00:00.000Z'),
    revoked_at: null,
    revocation_reason: null,
    ...overrides,
  };
}

const baseQuery = {
  limit: 20,
  cursor: undefined,
  status: undefined,
  q: undefined,
  sort: undefined,
} as const;

describe('SqlVerificationRepository.listForAdmin', () => {
  it('runs the page and the count together and returns the total from the count', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [row({ id: 'v-1' }), row({ id: 'v-2' })],
      [{ total: 2 }],
    ]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    const page = await repository.listForAdmin({ ...baseQuery });

    expect(page.items.map((item) => item.id)).toEqual(['v-1', 'v-2']);
    expect(page.total).toBe(2);
    expect(page.nextCursor).toBeNull();
    // Two statements: the page and the COUNT(*).
    expect(recordedQueries).toHaveLength(2);
    expect(recordedQueries[0].sql).toContain('SELECT');
    expect(recordedQueries[0].sql).toContain('LIMIT');
    expect(recordedQueries[1].sql).toContain('COUNT(*)');
  });

  it('asks for limit+1 rows so "is there a next page" needs no second read', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    await repository.listForAdmin({ ...baseQuery, limit: 5 });

    expect(recordedQueries[0].params).toContain(6);
  });

  it('parameterises the status and school filters instead of interpolating them', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    await repository.listForAdmin({ ...baseQuery, status: 'approved', q: "O'Brien" });

    const { sql, params } = recordedQueries[0];
    expect(sql).toContain('"status" = $1');
    expect(sql).toContain('"school_name" ILIKE $2');
    // The search term travels as a parameter (wildcards included), never as SQL text — an
    // apostrophe in a school name must not be able to alter the statement.
    expect(params).toContain("%O'Brien%");
    expect(sql).not.toContain("O'Brien");
  });

  it('applies the same filters to the count as to the page', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    await repository.listForAdmin({ ...baseQuery, status: 'pending', q: 'uni' });

    const count = recordedQueries[1];
    expect(count.sql).toContain('"status" = $1');
    expect(count.sql).toContain('"school_name" ILIKE $2');
    expect(count.params).toEqual(['pending', '%uni%']);
    // The count must not be limited — it counts every matching row.
    expect(count.sql).not.toContain('LIMIT');
  });

  it('emits a next cursor when a further page exists', async () => {
    const first = row({ id: 'v-1', created_at: new Date('2026-10-01T00:00:00.000Z') });
    const second = row({ id: 'v-2', created_at: new Date('2026-10-02T00:00:00.000Z') });
    const third = row({ id: 'v-3', created_at: new Date('2026-10-03T00:00:00.000Z') });
    const { registry } = createRecordingRegistry([[first, second, third], [{ total: 3 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    const page = await repository.listForAdmin({ ...baseQuery, limit: 2 });

    expect(page.items.map((item) => item.id)).toEqual(['v-1', 'v-2']);
    // The cursor is the last *returned* row's key, not the peek-ahead row's.
    expect(page.nextCursor).toBe(encodeCursor(['2026-10-02T00:00:00.000Z', 'v-2']));
  });

  it('continues from the cursor with the same tuple comparison the sort uses', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    const cursor = encodeCursor(['2026-10-02T00:00:00.000Z', 'v-2']);
    await repository.listForAdmin({ ...baseQuery, cursor });

    const { sql, params } = recordedQueries[0];
    expect(sql).toMatch(/\("created_at", "id"\) > \(\$\d+::timestamptz, \$\d+::uuid\)/);
    expect(params).toContain('2026-10-02T00:00:00.000Z');
    expect(params).toContain('v-2');
  });

  it('flips the tuple comparison for a descending sort', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    await repository.listForAdmin({
      ...baseQuery,
      sort: '-submittedAt',
      cursor: encodeCursor(['2026-10-02T00:00:00.000Z', 'v-2']),
    });

    expect(recordedQueries[0].sql).toMatch(
      /\("created_at", "id"\) < \(\$\d+::timestamptz, \$\d+::uuid\)/,
    );
    expect(recordedQueries[0].sql).toContain('ORDER BY "created_at" DESC');
  });

  it('orders by decided_at with NULLS LAST so undecided rows never head the queue', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    await repository.listForAdmin({ ...baseQuery, sort: 'decidedAt' });

    expect(recordedQueries[0].sql).toContain('ORDER BY "decided_at" ASC NULLS LAST');
  });

  it.each([
    ['-decidedAt', '"decided_at" DESC NULLS LAST'],
    ['submittedAt', '"created_at" ASC'],
    ['-submittedAt', '"created_at" DESC'],
  ])('honours the whitelisted sort %s', async (sort, expected) => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    await repository.listForAdmin({
      ...baseQuery,
      sort: sort as AdminVerificationSort,
    });

    expect(recordedQueries[0].sql).toContain(`ORDER BY ${expected}`);
  });

  it('rejects a cursor that does not carry exactly two key parts', async () => {
    const { registry } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    const malformed = encodeCursor(['only-one-part']);
    await expect(repository.listForAdmin({ ...baseQuery, cursor: malformed })).rejects.toBeInstanceOf(
      InvalidCursorError,
    );
  });

  it('returns an empty page with a zero total when nothing matches', async () => {
    const { registry } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlVerificationRepository(registry, 'student-verification');

    const page = await repository.listForAdmin({ ...baseQuery, status: 'revoked' });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.total).toBe(0);
  });
});
