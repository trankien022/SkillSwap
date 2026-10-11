import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlMyBookingsReader } from './sql-my-bookings-reader';

describe('SqlMyBookingsReader', () => {
  let mockQuery: jest.Mock;
  let mockDataSource: DataSource;
  let mockRegistry: ModuleDataSourceRegistry;
  let reader: SqlMyBookingsReader;
  const fixedNow = new Date('2026-10-15T10:00:00.000Z');

  beforeEach(() => {
    mockQuery = jest.fn();
    mockDataSource = {
      query: mockQuery,
    } as unknown as DataSource;
    mockRegistry = {
      get: jest.fn().mockReturnValue(mockDataSource),
      getSchema: jest.fn().mockReturnValue('live_class'),
    } as unknown as ModuleDataSourceRegistry;
    reader = new SqlMyBookingsReader(mockRegistry, 'live-class');
  });

  describe('SQL boundaries and strict learner ownership', () => {
    it('queries only live_class tables (classes, bookings, class_skills) with no cross-schema joins', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findBookings({
        learnerId: 'learner-1',
        limit: 20,
        now: fixedNow,
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];

      expect(sql).toContain('"live_class"."bookings"');
      expect(sql).toContain('"live_class"."classes"');
      expect(sql).toContain('"live_class"."class_skills"');

      expect(sql).not.toContain('account_profile');
      expect(sql).not.toContain('student_verification');
      expect(sql).not.toContain('skill_verification');
      expect(sql).not.toContain('wallet_ledger');
      expect(sql).toContain('"live_class"."ratings"');

      expect(sql).toContain('b."learner_id" = $1');
      expect(params[0]).toBe('learner-1');
    });

    it('ensures only caller own booked records are returned, preventing unowned data leaks', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          booking_id: 'bk-alice-1',
          class_id: 'cls-1',
          booking_state: 'confirmed',
          price_credits: 50,
          booking_created_at: '2026-10-10T09:00:00.000Z',
          booking_expires_at: null,
          class_description: 'Architecture',
          class_starts_at: '2026-10-16T10:00:00.000Z',
          class_duration_minutes: 60,
          class_teacher_id: 'teacher-1',
          class_state: 'published',
          skill_ids: ['sk-1'],
        },
      ]);

      const result = await reader.findBookings({
        learnerId: 'alice-id',
        limit: 10,
        now: fixedNow,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].bookingId).toBe('bk-alice-1');
      expect(result.items[0].class.description).toBe('Architecture');
      expect(result.items[0].class.skillIds).toEqual(['sk-1']);
    });
  });

  describe('upcoming predicate and complement filtering', () => {
    it('applies confirmed future non-cancelled/non-completed predicate when upcoming=true', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findBookings({
        learnerId: 'learner-1',
        upcoming: true,
        limit: 20,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(
        '(b."state" = \'confirmed\' AND c."starts_at" > $2 AND c."state" NOT IN (\'cancelled\', \'completed\'))',
      );
      expect(params[1]).toBe(fixedNow.toISOString());
    });

    it('applies complement predicate when upcoming=false, including cancelled or completed items', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findBookings({
        learnerId: 'learner-1',
        upcoming: false,
        limit: 20,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(
        'NOT (b."state" = \'confirmed\' AND c."starts_at" > $2 AND c."state" NOT IN (\'cancelled\', \'completed\'))',
      );
      expect(params[1]).toBe(fixedNow.toISOString());
    });

    it('omits upcoming condition entirely when upcoming is undefined (all histories)', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findBookings({
        learnerId: 'learner-1',
        limit: 20,
        now: fixedNow,
      });

      const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('c."starts_at" >');
      expect(sql).not.toContain('NOT (b."state" = \'confirmed\'');
    });

    it('applies state filter alongside upcoming filter', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await reader.findBookings({
        learnerId: 'learner-1',
        state: 'cancelled',
        upcoming: false,
        limit: 20,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('b."state" = $2');
      expect(params[1]).toBe('cancelled');
      expect(sql).toContain('NOT (b."state" = \'confirmed\' AND c."starts_at" > $3');
    });
  });

  describe('Keyset pagination and ordering', () => {
    it('applies keyset comparison and ORDER BY starts_at ASC, bookingId ASC', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const cursorDate = new Date('2026-10-18T10:00:00.000Z');
      await reader.findBookings({
        learnerId: 'learner-1',
        cursor: [cursorDate, 'bk-cursor-id'],
        limit: 5,
        now: fixedNow,
      });

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('((c."starts_at", b."id"::text) > ($2, $3))');
      expect(params[1]).toBe(cursorDate.toISOString());
      expect(params[2]).toBe('bk-cursor-id');
      expect(sql).toContain('ORDER BY c."starts_at" ASC, b."id" ASC');
      expect(sql).toContain('LIMIT $4');
      expect(params[3]).toBe(6); // limit + 1
    });

    it('produces nextCursor when more rows exist than limit', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          booking_id: 'bk-1',
          class_id: 'cls-1',
          booking_state: 'confirmed',
          price_credits: 50,
          booking_created_at: '2026-10-10T09:00:00.000Z',
          booking_expires_at: null,
          class_description: 'Class 1',
          class_starts_at: '2026-10-16T10:00:00.000Z',
          class_duration_minutes: 60,
          class_teacher_id: 'teacher-1',
          class_state: 'published',
          skill_ids: [],
        },
        {
          booking_id: 'bk-2',
          class_id: 'cls-2',
          booking_state: 'confirmed',
          price_credits: 50,
          booking_created_at: '2026-10-10T09:00:00.000Z',
          booking_expires_at: null,
          class_description: 'Class 2',
          class_starts_at: '2026-10-17T10:00:00.000Z',
          class_duration_minutes: 60,
          class_teacher_id: 'teacher-1',
          class_state: 'published',
          skill_ids: [],
        },
      ]);

      const result = await reader.findBookings({
        learnerId: 'learner-1',
        limit: 1, // requested 1, returned 2
        now: fixedNow,
      });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toEqual(['2026-10-16T10:00:00.000Z', 'bk-1']);
    });
  });

  describe('countTotalUpcoming', () => {
    it('executes exact count query for caller confirmed future non-cancelled/non-completed classes', async () => {
      mockQuery.mockResolvedValueOnce([{ count: 4 }]);

      const count = await reader.countTotalUpcoming('learner-alice', fixedNow);

      expect(count).toBe(4);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];

      expect(sql).toContain('SELECT COUNT(*)::int AS "count"');
      expect(sql).toContain('FROM "live_class"."bookings" b');
      expect(sql).toContain('JOIN "live_class"."classes" c ON b."class_id" = c."id"');
      expect(sql).toContain('WHERE b."learner_id" = $1');
      expect(sql).toContain('AND b."state" = \'confirmed\'');
      expect(sql).toContain('AND c."starts_at" > $2');
      expect(sql).toContain('AND c."state" NOT IN (\'cancelled\', \'completed\')');

      expect(params).toEqual(['learner-alice', fixedNow.toISOString()]);
    });
  });
});
