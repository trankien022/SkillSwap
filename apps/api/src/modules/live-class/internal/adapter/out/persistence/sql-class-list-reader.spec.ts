import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlClassListReader } from './sql-class-list-reader';

describe('SqlClassListReader', () => {
  let mockQuery: jest.Mock;
  let mockDataSource: DataSource;
  let mockRegistry: ModuleDataSourceRegistry;
  let reader: SqlClassListReader;
  const fixedNow = new Date('2026-10-12T12:00:00.000Z');

  beforeEach(() => {
    mockQuery = jest.fn();
    mockDataSource = {
      query: mockQuery,
    } as unknown as DataSource;
    mockRegistry = {
      get: jest.fn().mockReturnValue(mockDataSource),
      getSchema: jest.fn().mockReturnValue('live_class'),
    } as unknown as ModuleDataSourceRegistry;
    reader = new SqlClassListReader(mockRegistry, 'live-class');
  });

  describe('SQL boundaries and security', () => {
    it('queries only live_class tables (classes, class_skills, bookings) with no cross-schema joins', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findClasses({
        mode: 'marketplace',
        callerId: 'user-1',
        limit: 20,
        now: fixedNow,
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];

      expect(sql).toContain('"live_class"."classes"');
      expect(sql).toContain('"live_class"."class_skills"');
      expect(sql).toContain('"live_class"."bookings"');

      // Crucial: no cross-schema joins or fabricated rating tables
      expect(sql).not.toContain('account_profile');
      expect(sql).not.toContain('student_verification');
      expect(sql).not.toContain('skill_verification');
      expect(sql).not.toContain('wallet_ledger');
      expect(sql).not.toContain('ratings');
    });
  });

  describe('Seat availability math and confirmed count retention', () => {
    it('correctly subtracts confirmed + non-expired pending holds, retaining confirmed count separately', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'cls-1',
          teacher_id: 'teacher-1',
          state: 'published',
          starts_at: '2026-10-15T10:00:00.000Z',
          duration_minutes: 60,
          price_credits: 100,
          capacity: 10,
          description: 'Web development with React',
          skill_ids: ['sk-react'],
          confirmed_bookings_count: 3, // 3 confirmed
          held_seats_count: 5,        // 3 confirmed + 2 active pending holds
        },
      ]);

      const result = await reader.findClasses({
        mode: 'marketplace',
        callerId: 'learner-1',
        limit: 10,
        now: fixedNow,
      });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.capacity).toBe(10);
      expect(item.confirmedBookingsCount).toBe(3);
      expect(item.availableSeats).toBe(5); // 10 - 5 = 5
      expect(item.skillIds).toEqual(['sk-react']);
    });
  });

  describe('Parameterized filters', () => {
    it('uses EXISTS for skill filtering to avoid row multiplication', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findClasses({
        mode: 'marketplace',
        callerId: 'learner-1',
        skillId: 'sk-flutter',
        limit: 10,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('EXISTS (SELECT 1 FROM "live_class"."class_skills" sf WHERE sf."class_id" = c."id" AND sf."skill_id" = $');
      expect(params).toContain('sk-flutter');
    });

    it('filters by keyword on description using ILIKE', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findClasses({
        mode: 'marketplace',
        callerId: 'learner-1',
        keyword: 'python data',
        limit: 10,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('c."description" ILIKE $');
      expect(params).toContain('%python data%');
    });

    it('enforces starts_at >= minStartsAt and state IN (published, full) in marketplace mode', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const minDate = new Date('2026-10-13T12:00:00.000Z');
      await reader.findClasses({
        mode: 'marketplace',
        callerId: 'learner-1',
        minStartsAt: minDate,
        limit: 10,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('c."state" IN (\'published\', \'full\')');
      expect(sql).toContain('c."starts_at" >= $');
      expect(params).toContain(minDate.toISOString());
    });

    it('filters by teacher_id in own mode without state or minStartsAt restrictions', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findClasses({
        mode: 'own',
        callerId: 'teacher-caller',
        limit: 10,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('c."teacher_id" = $');
      expect(sql).not.toContain('c."state" IN (\'published\', \'full\')');
      expect(params).toContain('teacher-caller');
    });

    it('applies keyset cursor and deterministic ordering by starts_at ASC, id ASC', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const cursorDate = new Date('2026-10-15T10:00:00.000Z');
      await reader.findClasses({
        mode: 'marketplace',
        callerId: 'learner-1',
        cursor: [cursorDate, 'cls-cursor-id'],
        limit: 10,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('(c."starts_at", c."id"::text) > ($');
      expect(sql).toContain('ORDER BY c."starts_at" ASC, c."id" ASC');
      expect(params).toContain(cursorDate.toISOString());
      expect(params).toContain('cls-cursor-id');
      expect(params).toContain(11); // limit + 1
    });
  });

  describe('countActiveTeaching', () => {
    it('executes exact count across published, full, in_progress classes where scheduledEnd > now', async () => {
      mockQuery.mockResolvedValueOnce([{ count: 4 }]);

      const count = await reader.countActiveTeaching('teacher-1', fixedNow);

      expect(count).toBe(4);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];

      expect(sql).toContain('SELECT COUNT(*)::int AS "count"');
      expect(sql).toContain('FROM "live_class"."classes"');
      expect(sql).toContain('"teacher_id" = $1');
      expect(sql).toContain('"state" IN (\'published\', \'full\', \'in_progress\')');
      expect(sql).toContain('("starts_at" + ("duration_minutes" || \' minutes\')::interval) > $2');
      expect(params).toEqual(['teacher-1', fixedNow.toISOString()]);
    });
  });
});
