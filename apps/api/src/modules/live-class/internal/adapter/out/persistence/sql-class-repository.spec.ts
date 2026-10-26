import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlClassRepository } from './sql-class-repository';

/**
 * ADR-021 Amendment A / AC-035: the ONLY way a class completes is the scheduled
 * end. These specs pin that invariant to the query itself, because
 * `CompleteElapsedClassesUseCase` trusts whatever the repository returns — if the
 * `starts_at + duration <= now` filter ever moved into JavaScript, a future defect
 * there would release a teacher's income for a class that has not run.
 */
describe('SqlClassRepository.findAwaitingCompletion (ADR-021 Amendment A)', () => {
  let mockQuery: jest.Mock;
  let repository: SqlClassRepository;
  const now = new Date('2026-10-12T12:00:00.000Z');

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const mockRegistry = {
      get: jest.fn().mockReturnValue({ query: mockQuery } as unknown as DataSource),
      getSchema: jest.fn().mockReturnValue('live_class'),
    } as unknown as ModuleDataSourceRegistry;
    repository = new SqlClassRepository(mockRegistry as never, 'live-class');
  });

  it('filters on starts_at + duration in SQL, never in JavaScript', async () => {
    await repository.findAwaitingCompletion(now);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];

    expect(sql).toMatch(/"starts_at"\s*\+\s*\("duration_minutes"\s*\|\|\s*' minutes'\)::interval\)\s*<=\s*\$1/);
    // The clock is a bound parameter, not string-interpolated into the statement.
    expect(sql).not.toContain(now.toISOString());
  });

  it('passes the clock as a parameter', async () => {
    await repository.findAwaitingCompletion(now);

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([now.toISOString()]);
  });

  it('only considers classes that could still be running', async () => {
    await repository.findAwaitingCompletion(now);

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("'published', 'full', 'in_progress'");
    // A cancelled or already-completed class must never be re-completed.
    expect(sql).not.toContain("'cancelled'");
    expect(sql).not.toContain("'completed'");
  });

  it('stays inside the live_class schema', async () => {
    await repository.findAwaitingCompletion(now);

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain('FROM "live_class"."classes"');
    expect(sql).not.toMatch(/wallet_ledger|account_profile|admin_operation/);
  });

  it('maps rows to the domain shape the use case consumes', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        id: 'cls-1',
        teacher_id: 't1',
        state: 'in_progress',
        starts_at: now,
        duration_minutes: 60,
      },
    ]);

    const result = await repository.findAwaitingCompletion(now);

    expect(result).toEqual([
      { id: 'cls-1', teacherId: 't1', state: 'in_progress', startsAt: now, durationMinutes: 60 },
    ]);
  });
});

/**
 * AC-035: the idle sweep may only ever see classes that have **started** and have not
 * yet ended. If an unstarted class leaked into this query, an empty room would complete
 * it and release the Teacher's income for a session nobody attended.
 */
describe('SqlClassRepository.findInProgressBeforeEnd (AC-035)', () => {
  let mockQuery: jest.Mock;
  let repository: SqlClassRepository;
  const now = new Date('2026-10-12T12:00:00.000Z');

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const mockRegistry = {
      get: jest.fn().mockReturnValue({ query: mockQuery } as unknown as DataSource),
      getSchema: jest.fn().mockReturnValue('live_class'),
    } as unknown as ModuleDataSourceRegistry;
    repository = new SqlClassRepository(mockRegistry as never, 'live-class');
  });

  it('requires the class to have started', async () => {
    await repository.findInProgressBeforeEnd(now);

    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/"starts_at"\s*<=\s*\$1/);
  });

  it('excludes classes already at their scheduled end, which the elapsed sweep owns', async () => {
    await repository.findInProgressBeforeEnd(now);

    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    // Strictly greater, so the two sweeps cannot both claim the same class.
    expect(sql).toMatch(/::interval\)\s*>\s*\$1/);
    expect(sql).not.toMatch(/::interval\)\s*>=\s*\$1/);
  });

  it('never returns a terminal class', async () => {
    await repository.findInProgressBeforeEnd(now);

    const [sql] = mockQuery.mock.calls[0] as [string];
    expect(sql).toContain("'published', 'full', 'in_progress'");
    expect(sql).not.toContain("'completed'");
    expect(sql).not.toContain("'cancelled'");
  });

  it('stays inside the live_class schema and binds the clock', async () => {
    await repository.findInProgressBeforeEnd(now);

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM "live_class"."classes"');
    expect(sql).not.toMatch(/wallet_ledger|account_profile|admin_operation/);
    expect(params).toEqual([now.toISOString()]);
  });
});

/**
 * AC-035 / ADR-021 Amendment A: `room_idle` releases income, so "completed before it
 * started" must be unrepresentable at the statement, not merely avoided by the caller.
 */
describe('SqlClassRepository.completeAndEmit (AC-035)', () => {
  let mockQuery: jest.Mock;
  let repository: SqlClassRepository;

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const mockRegistry = {
      get: jest.fn().mockReturnValue({ query: mockQuery } as unknown as DataSource),
      getSchema: jest.fn().mockReturnValue('live_class'),
    } as unknown as ModuleDataSourceRegistry;
    repository = new SqlClassRepository(mockRegistry as never, 'live-class');
  });

  async function updateStatement(basis: 'scheduled_end' | 'room_idle'): Promise<string> {
    const transaction = {
      // State-transition UPDATE first, then the confirmed-bookings read.
      query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    };
    mockQuery.mockReturnValue(transaction);
    const source = {
      transaction: async (work: (manager: typeof transaction) => Promise<unknown>) =>
        work(transaction),
    };
    (repository as unknown as { registry: unknown }).registry = {
      get: jest.fn().mockReturnValue(source),
      getSchema: jest.fn().mockReturnValue('live_class'),
    };
    await repository.completeAndEmit('cls-1', basis);
    return transaction.query.mock.calls[0][0] as string;
  }

  it('refuses to record room_idle for a class that has not started', async () => {
    const sql = await updateStatement('room_idle');
    expect(sql).toMatch(/"starts_at"\s*<=\s*now\(\)/);
  });

  it('does not apply the start-time guard to the scheduled-end basis', async () => {
    // `scheduled_end` is by definition after the start; adding the guard there would only
    // complicate the statement that has always worked.
    const sql = await updateStatement('scheduled_end');
    expect(sql).not.toContain('"starts_at"');
  });
});
