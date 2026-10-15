import { SqlVerificationSummaryReader } from './sql-verification-summary-reader';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';

/**
 * FR-015 / ADR-034 §7: the student-verification counts.
 *
 * The property that matters is that absent statuses become explicit zeroes. A dashboard that had
 * to tell "no rejected rows" from "rejected was not counted" would eventually show a blank where
 * a zero belongs, which on an operations screen reads as a bug.
 */

function createRegistry(responses: unknown[]) {
  const recordedQueries: Array<{ sql: string; params?: unknown[] }> = [];
  const queue = [...responses];
  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    if (queue.length === 0) throw new Error(`Unexpected query: ${sql}`);
    return queue.shift();
  });
  const registry = {
    getSchema: jest.fn(() => 'student_verification'),
    get: jest.fn(() => ({ query: mockQuery })),
  } as unknown as ModuleDataSourceRegistry;
  return { registry, recordedQueries };
}

describe('SqlVerificationSummaryReader', () => {
  it('counts every status in one grouped query', async () => {
    const { registry, recordedQueries } = createRegistry([
      [
        { status: 'pending', count: 3 },
        { status: 'approved', count: 5 },
      ],
    ]);
    const reader = new SqlVerificationSummaryReader(registry, 'student-verification');

    await reader.read();

    expect(recordedQueries).toHaveLength(1);
    expect(recordedQueries[0].sql).toContain('GROUP BY "status"');
  });

  it('fills absent statuses with zero', async () => {
    const { registry } = createRegistry([[{ status: 'pending', count: 3 }]]);
    const reader = new SqlVerificationSummaryReader(registry, 'student-verification');

    const summary = await reader.read();

    expect(summary.byStatus).toEqual({ pending: 3, approved: 0, rejected: 0, revoked: 0 });
  });

  it('totals across every status', async () => {
    const { registry } = createRegistry([
      [
        { status: 'pending', count: 3 },
        { status: 'approved', count: 5 },
        { status: 'revoked', count: 2 },
      ],
    ]);
    const reader = new SqlVerificationSummaryReader(registry, 'student-verification');

    const summary = await reader.read();

    expect(summary.total).toBe(10);
  });

  it('ignores a status it does not know rather than crashing the dashboard', async () => {
    const { registry } = createRegistry([
      [
        { status: 'pending', count: 1 },
        { status: 'archived', count: 99 },
      ],
    ]);
    const reader = new SqlVerificationSummaryReader(registry, 'student-verification');

    const summary = await reader.read();

    expect(summary.byStatus).toEqual({ pending: 1, approved: 0, rejected: 0, revoked: 0 });
    expect(summary.total).toBe(1);
  });

  it('reads its own schema only', async () => {
    const { registry, recordedQueries } = createRegistry([[]]);
    const reader = new SqlVerificationSummaryReader(registry, 'student-verification');

    await reader.read();

    expect(recordedQueries[0].sql).toContain('"student_verification"."student_verifications"');
  });

  it('returns all zeroes when there are no rows at all', async () => {
    const { registry } = createRegistry([[]]);
    const reader = new SqlVerificationSummaryReader(registry, 'student-verification');

    const summary = await reader.read();

    expect(summary.byStatus).toEqual({ pending: 0, approved: 0, rejected: 0, revoked: 0 });
    expect(summary.total).toBe(0);
  });
});
