import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlTeacherTrustProjector } from './sql-teacher-trust-projector';

describe('SqlTeacherTrustProjector — the projected school (B4)', () => {
  let mockQuery: jest.Mock;
  let projector: SqlTeacherTrustProjector;

  beforeEach(() => {
    mockQuery = jest.fn();
    const registry = {
      get: jest.fn().mockReturnValue({ query: mockQuery } as unknown as DataSource),
      getSchema: jest.fn().mockReturnValue('live_class'),
    } as unknown as ModuleDataSourceRegistry;
    projector = new SqlTeacherTrustProjector(registry, 'live-class');
  });

  it('reads the school from the same local projection row as the flag', async () => {
    mockQuery
      .mockResolvedValueOnce([{ verified: true, school_name: 'FPT University' }])
      .mockResolvedValueOnce([{ skill_id: 'sk-1', approved_level: 'expert' }]);

    const trust = await projector.read('account-1');

    expect(trust.verified).toBe(true);
    expect(trust.schoolName).toBe('FPT University');
    // Still one query per projection table, no cross-schema hop to `student_verification`.
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('"live_class"."teacher_verified"');
    expect(sql).not.toContain('student_verification');
  });

  it('reports no school when the row predates the column', async () => {
    mockQuery
      .mockResolvedValueOnce([{ verified: true, school_name: null }])
      .mockResolvedValueOnce([]);

    const trust = await projector.read('account-1');

    // An un-backfilled row means "we do not know the school", not "verified at nowhere".
    expect(trust.verified).toBe(true);
    expect(trust.schoolName).toBeNull();
  });

  it('reports unverified and no school when the account has no projection row', async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const trust = await projector.read('account-with-no-events');

    expect(trust.verified).toBe(false);
    expect(trust.schoolName).toBeNull();
  });

  it('writes the school and keeps last-writer-wins on occurred_at', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await projector.upsertVerified({
      accountId: 'account-1',
      verified: true,
      schoolName: 'FPT University',
      occurredAt: '2026-10-12T10:00:00.000Z',
    });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('"school_name"');
    expect(sql).toContain('ON CONFLICT ("account_id") DO UPDATE');
    // The guard is what makes a replayed older event harmless (ADR-013).
    expect(sql).toContain(`"occurred_at" < EXCLUDED."occurred_at"`);
    expect(params).toEqual([
      'account-1',
      true,
      'FPT University',
      '2026-10-12T10:00:00.000Z',
    ]);
  });
});
