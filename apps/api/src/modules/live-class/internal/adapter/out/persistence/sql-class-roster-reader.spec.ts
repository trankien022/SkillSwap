import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlClassRosterReader } from './sql-class-roster-reader';

const NOW = new Date('2026-11-10T10:00:00.000Z');

describe('SqlClassRosterReader (FR-011 / ADR-040)', () => {
  let mockQuery: jest.Mock;
  let reader: SqlClassRosterReader;

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const registry = {
      get: jest.fn().mockReturnValue({ query: mockQuery } as unknown as DataSource),
      getSchema: jest.fn().mockReturnValue('live_class'),
    } as unknown as ModuleDataSourceRegistry;
    reader = new SqlClassRosterReader(registry, 'live-class');
  });

  it('reads live_class.bookings only, with no cross-schema join (ADR-014)', async () => {
    await reader.findActiveSeats({ classId: 'cls-1', now: NOW });

    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('"live_class"."bookings"');
    expect(sql).not.toContain('account_profile');
    expect(sql).not.toContain('student_verification');
    expect(sql).not.toContain('skill_verification');
    expect(sql).not.toContain('wallet_ledger');
  });

  it('scopes the read to the class id', async () => {
    await reader.findActiveSeats({ classId: 'cls-1', now: NOW });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('b."class_id" = $1');
    expect(params[0]).toBe('cls-1');
  });

  it('counts a pending seat only while its hold is unexpired', async () => {
    await reader.findActiveSeats({ classId: 'cls-1', now: NOW });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`b."state" = 'confirmed'`);
    expect(sql).toContain(`b."state" = 'pending' AND b."expires_at" > $2`);
    expect(params[1]).toBe(NOW.toISOString());
  });

  it('maps rows onto the port shape, normalising the state', async () => {
    mockQuery.mockResolvedValueOnce([
      { booking_id: 'b1', learner_id: 'l1', state: 'confirmed', created_at: '2026-11-01T09:00:00.000Z' },
      { booking_id: 'b2', learner_id: 'l2', state: 'pending', created_at: new Date('2026-11-02T09:00:00.000Z') },
    ]);

    const seats = await reader.findActiveSeats({ classId: 'cls-1', now: NOW });

    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ bookingId: 'b1', learnerId: 'l1', state: 'confirmed' });
    expect(seats[1].state).toBe('pending');
    expect(seats[1].createdAt).toBeInstanceOf(Date);
  });
});
