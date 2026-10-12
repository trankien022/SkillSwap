import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlClassDetailReader } from './sql-class-detail-reader';

describe('SqlClassDetailReader', () => {
  let mockQuery: jest.Mock;
  let mockDataSource: DataSource;
  let mockRegistry: ModuleDataSourceRegistry;
  let reader: SqlClassDetailReader;
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
    reader = new SqlClassDetailReader(mockRegistry, 'live-class');
  });

  describe('SQL boundaries and security', () => {
    it('queries only live_class tables (classes, class_skills, bookings) with no cross-schema joins', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // class query
        .mockResolvedValueOnce([]); // bookings query

      const result = await reader.readDetail('cls-1', 'caller-1', fixedNow);
      expect(result).toBeNull();

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const [classSql] = mockQuery.mock.calls[0] as [string, unknown[]];
      const [bookingSql] = mockQuery.mock.calls[1] as [string, unknown[]];

      expect(classSql).toContain('"live_class"."classes"');
      expect(classSql).toContain('"live_class"."class_skills"');
      expect(classSql).toContain('"live_class"."bookings"');

      expect(classSql).not.toContain('account_profile');
      expect(classSql).not.toContain('student_verification');
      expect(classSql).not.toContain('skill_verification');
      expect(classSql).not.toContain('wallet_ledger');
      expect(classSql).not.toContain('ratings');

      expect(bookingSql).toContain('"live_class"."bookings"');
      expect(bookingSql).not.toContain('ratings');
    });

    it('ensures caller bookings query is strictly scoped to callerId, hiding other learners private details', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await reader.readDetail('cls-target', 'private-caller-id', fixedNow);

      const [bookingSql, bookingParams] = mockQuery.mock.calls[1] as [string, unknown[]];
      expect(bookingSql).toContain('WHERE b."class_id" = $1');
      expect(bookingSql).toContain('AND b."learner_id" = $2');
      expect(bookingParams).toEqual(['cls-target', 'private-caller-id']);
    });
  });

  describe('Capacity math and held seats calculation', () => {
    it('calculates available seats as capacity - held_seats_count (confirmed + active pending)', async () => {
      mockQuery
        .mockResolvedValueOnce([
          {
            id: 'cls-1',
            teacher_id: 'teacher-1',
            state: 'published',
            starts_at: '2026-10-15T10:00:00.000Z',
            duration_minutes: 60,
            price_credits: 100,
            capacity: 10,
            description: 'Advanced Typescript',
            skill_ids: ['sk-ts-1'],
            confirmed_bookings_count: 2,
            held_seats_count: 4, // 2 confirmed + 2 active pending holds
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'bk-caller-1',
            state: 'confirmed',
            expires_at: null,
            created_at: '2026-10-11T09:00:00.000Z',
          },
        ]);

      const result = await reader.readDetail('cls-1', 'caller-1', fixedNow);

      expect(result).not.toBeNull();
      expect(result!.capacity).toBe(10);
      expect(result!.confirmedBookingsCount).toBe(2);
      expect(result!.heldSeatsCount).toBe(4);
      expect(result!.availableSeats).toBe(6); // 10 - 4 = 6
      expect(result!.callerBookings).toHaveLength(1);
      expect(result!.callerBookings[0].id).toBe('bk-caller-1');
      expect(result!.callerBookings[0].state).toBe('confirmed');
    });

    it('returns empty array when skill_ids is null or empty', async () => {
      mockQuery
        .mockResolvedValueOnce([
          {
            id: 'cls-1',
            teacher_id: 'teacher-1',
            state: 'published',
            starts_at: '2026-10-15T10:00:00.000Z',
            duration_minutes: 60,
            price_credits: 100,
            capacity: 10,
            description: 'No skills class',
            skill_ids: null,
            confirmed_bookings_count: 0,
            held_seats_count: 0,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await reader.readDetail('cls-1', 'caller-1', fixedNow);

      expect(result).not.toBeNull();
      expect(result!.skillIds).toEqual([]);
      expect(result!.callerBookings).toEqual([]);
    });
  });
});
