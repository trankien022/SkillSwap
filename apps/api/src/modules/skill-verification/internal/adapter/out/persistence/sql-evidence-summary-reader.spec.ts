import { SqlEvidenceSummaryReader } from './sql-evidence-summary-reader';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';

/**
 * FR-015 / ADR-034 §7: the skill-evidence counts.
 *
 * Two things are worth pinning beyond the status counts. First, `byDomain` counts only the two
 * live queue statuses — a domain whose work is all decided has no queue, so counting approvals
 * there would send an administrator to an empty screen. Second, both queries stay inside
 * `skill_verification` (ADR-014): the domain join is to this module's own taxonomy tables.
 */

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

function createRegistry(statusRows: unknown[], domainRows: unknown[]) {
  const recordedQueries: RecordedQuery[] = [];
  const queue: unknown[] = [statusRows, domainRows];
  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    return queue.shift() ?? [];
  });
  const registry = {
    getSchema: jest.fn(() => 'skill_verification'),
    get: jest.fn(() => ({ query: mockQuery })),
  } as unknown as ModuleDataSourceRegistry;
  return { registry, recordedQueries };
}

describe('SqlEvidenceSummaryReader', () => {
  it('counts statuses and domains in two grouped queries', async () => {
    const { registry, recordedQueries } = createRegistry([], []);
    const reader = new SqlEvidenceSummaryReader(registry, 'skill-verification');

    await reader.read();

    expect(recordedQueries).toHaveLength(2);
    expect(recordedQueries[0].sql).toContain('GROUP BY "status"');
    expect(recordedQueries[1].sql).toContain('GROUP BY s."category"');
  });

  it('restricts the domain split to the live queue statuses', async () => {
    const { registry, recordedQueries } = createRegistry([], []);
    const reader = new SqlEvidenceSummaryReader(registry, 'skill-verification');

    await reader.read();

    expect(recordedQueries[1].sql).toContain('e."status" = ANY($1::text[])');
    expect(recordedQueries[1].params).toEqual([['pending', 'claimed']]);
  });

  it('fills absent statuses with zero', async () => {
    const { registry } = createRegistry([{ status: 'pending', count: 2 }], []);
    const reader = new SqlEvidenceSummaryReader(registry, 'skill-verification');

    const summary = await reader.read();

    expect(summary.byStatus).toEqual({
      pending: 2,
      claimed: 0,
      approved: 0,
      rejected: 0,
      superseded: 0,
    });
    expect(summary.total).toBe(2);
  });

  it('keys the domain map by taxonomy category', async () => {
    const { registry } = createRegistry(
      [],
      [
        { category: 'Programming', count: 4 },
        { category: 'Languages', count: 1 },
      ],
    );
    const reader = new SqlEvidenceSummaryReader(registry, 'skill-verification');

    const summary = await reader.read();

    expect(summary.byDomain).toEqual({ Programming: 4, Languages: 1 });
  });

  it('omits a domain with no live work rather than reporting zero', async () => {
    const { registry } = createRegistry([], [{ category: 'Programming', count: 4 }]);
    const reader = new SqlEvidenceSummaryReader(registry, 'skill-verification');

    const summary = await reader.read();

    expect(summary.byDomain).not.toHaveProperty('Languages');
  });

  it('joins only its own schema tables', async () => {
    const { registry, recordedQueries } = createRegistry([], []);
    const reader = new SqlEvidenceSummaryReader(registry, 'skill-verification');

    await reader.read();

    for (const { sql } of recordedQueries) {
      expect(sql).not.toMatch(/"(student_verification|admin_operation|account_profile)"/);
    }
  });

  it('returns an empty domain map when no domain has work', async () => {
    const { registry } = createRegistry([], []);
    const reader = new SqlEvidenceSummaryReader(registry, 'skill-verification');

    const summary = await reader.read();

    expect(summary.byDomain).toEqual({});
  });
});
