import { SqlBookingRepository } from './sql-booking-repository';
import { BookingNotAllowedError } from '../../../domain/booking';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import type {
  BookingSeatRow,
  CreateBookingRecord,
} from '../../../application/port/out/booking-repository';

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

function createQueueRegistry(responses: unknown[]) {
  const recordedQueries: RecordedQuery[] = [];
  const queue = [...responses];

  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    if (queue.length === 0) {
      throw new Error(`Unexpected query: ${sql} with params ${JSON.stringify(params)}`);
    }
    const next = queue.shift();
    if (typeof next === 'function') {
      return next(sql, params);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });

  const manager = {
    query: mockQuery,
  };

  const dataSource = {
    query: mockQuery,
    transaction: jest.fn(async <T>(cb: (mgr: typeof manager) => Promise<T>): Promise<T> => {
      return cb(manager);
    }),
  };

  const registry = {
    getSchema: jest.fn(() => 'live_class'),
    get: jest.fn(() => dataSource),
  } as unknown as ModuleDataSourceRegistry;

  return { registry, dataSource, manager, recordedQueries };
}

const NOW = new Date('2026-10-08T00:00:00.000Z');

const samplePendingRow = {
  id: 'bkg-1',
  class_id: 'cls-1',
  learner_id: 'learner-1',
  state: 'pending',
  price_credits: 100,
  idempotency_key: 'idem-1',
  created_at: NOW,
  expires_at: new Date(NOW.getTime() + 15 * 60 * 1000),
};

const sampleConfirmedRow = {
  ...samplePendingRow,
  state: 'confirmed',
  expires_at: null,
};

describe('SqlBookingRepository', () => {
  describe('createWithSeatGuard', () => {
    const record: CreateBookingRecord = {
      classId: 'cls-1',
      learnerId: 'learner-1',
      state: 'pending',
      priceCredits: 100,
      idempotencyKey: 'idem-1',
      expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
    };

    it('locks class, executes seat guard, and inserts booking when key is new', async () => {
      const seatRows: BookingSeatRow[] = [];
      const guard = jest.fn((rows: readonly BookingSeatRow[]) => {
        seatRows.push(...rows);
      });

      const { registry, recordedQueries } = createQueueRegistry([
        [{ id: 'cls-1' }], // 1. Lock class row FOR UPDATE
        [], // 2. Check existing idempotency key -> none
        [{ learner_id: 'other', state: 'confirmed' }], // 3. Query existing seats
        [samplePendingRow], // 4. Insert booking RETURNING
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const result = await repo.createWithSeatGuard(record, guard);

      expect(guard).toHaveBeenCalledTimes(1);
      expect(seatRows).toEqual([{ learnerId: 'other', state: 'confirmed' }]);
      expect(result.created).toBe(true);
      expect(result.booking.id).toBe('bkg-1');
      expect(result.booking.learnerId).toBe('learner-1');
      expect(result.booking.state).toBe('pending');

      expect(recordedQueries[0].sql).toContain('SELECT "id" FROM "live_class"."classes" WHERE "id" = $1 FOR UPDATE');
      expect(recordedQueries[0].params).toEqual(['cls-1']);
      expect(recordedQueries[1].sql).toContain('WHERE "idempotency_key" = $1');
      expect(recordedQueries[3].sql).toContain('ON CONFLICT ("idempotency_key") DO NOTHING');
    });

    it('replays existing booking without running guard or inserting when same learner and class', async () => {
      const guard = jest.fn();
      const { registry, recordedQueries } = createQueueRegistry([
        [{ id: 'cls-1' }], // 1. Lock class row
        [samplePendingRow], // 2. Check existing idempotency key -> found matching row
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const result = await repo.createWithSeatGuard(record, guard);

      expect(guard).not.toHaveBeenCalled();
      expect(result.created).toBe(false);
      expect(result.booking.id).toBe('bkg-1');
      expect(result.booking.learnerId).toBe('learner-1');
      expect(recordedQueries).toHaveLength(2);
    });

    it('rejects replay with BookingNotAllowedError (duplicate_booking) when key belongs to different learner', async () => {
      const guard = jest.fn();
      const victimRow = {
        ...samplePendingRow,
        learner_id: 'victim-learner',
      };
      const { registry } = createQueueRegistry([
        [{ id: 'cls-1' }],
        [victimRow],
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      try {
        await repo.createWithSeatGuard(record, guard);
        throw new Error("Expected replay ownership rejection");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BookingNotAllowedError);
        const bne = err as BookingNotAllowedError;
        expect(bne.reason).toBe('duplicate_booking');
        expect(bne.message).not.toContain('victim-learner');
      }
      expect(guard).not.toHaveBeenCalled();
    });

    it('rejects replay with BookingNotAllowedError (duplicate_booking) when key belongs to different class', async () => {
      const guard = jest.fn();
      const otherClassRow = {
        ...samplePendingRow,
        class_id: 'cls-different',
      };
      const { registry } = createQueueRegistry([
        [{ id: 'cls-1' }],
        [otherClassRow],
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      try {
        await repo.createWithSeatGuard(record, guard);
        throw new Error("Expected replay ownership rejection");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BookingNotAllowedError);
        const bne = err as BookingNotAllowedError;
        expect(bne.reason).toBe('duplicate_booking');
        expect(bne.message).not.toContain('cls-different');
      }
      expect(guard).not.toHaveBeenCalled();
    });

    it('handles concurrency race where ON CONFLICT DO NOTHING returns 0 rows and replays matching row', async () => {
      const guard = jest.fn();
      const { registry, recordedQueries } = createQueueRegistry([
        [{ id: 'cls-1' }], // 1. Lock class
        [], // 2. Pre-insert idempotency lookup -> empty
        [], // 3. Seat rows
        [], // 4. Insert returns 0 rows (ON CONFLICT DO NOTHING triggered)
        [samplePendingRow], // 5. Race recovery lookup by idempotency key -> found same learner/class
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const result = await repo.createWithSeatGuard(record, guard);

      expect(result.created).toBe(false);
      expect(result.booking.id).toBe('bkg-1');
      expect(recordedQueries[4].sql).toContain('WHERE "idempotency_key" = $1');
      expect(recordedQueries[4].params).toEqual(['idem-1']);
    });

    it('handles concurrency race where ON CONFLICT DO NOTHING returns 0 rows and rejects different learner', async () => {
      const guard = jest.fn();
      const victimRow = {
        ...samplePendingRow,
        learner_id: 'other-learner',
      };
      const { registry } = createQueueRegistry([
        [{ id: 'cls-1' }],
        [],
        [],
        [], // 0 rows inserted
        [victimRow], // Race lookup found different learner
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      await expect(repo.createWithSeatGuard(record, guard)).rejects.toThrow(BookingNotAllowedError);
    });

    it('propagates failed INSERT without querying an aborted database transaction', async () => {
      const failure = new Error('database insert failed');
      const { registry, recordedQueries } = createQueueRegistry([
        [{ id: 'cls-1' }], [], [], failure,
      ]);
      const repo = new SqlBookingRepository(registry, 'live-class');
      await expect(repo.createWithSeatGuard(record, jest.fn())).rejects.toBe(failure);
      expect(recordedQueries).toHaveLength(4);
    });
  });

  describe('confirmAndEmit', () => {
    it('binds booking id and learner id in owner-scoped lock query and returns null when not found', async () => {
      const { registry, recordedQueries } = createQueueRegistry([
        [], // Lock query returns no matching row
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const outcome = await repo.confirmAndEmit('bkg-1', 'learner-1');

      expect(outcome.confirmed).toBe(false);
      expect(outcome.booking).toBeNull();
      expect(recordedQueries).toHaveLength(1);
      expect(recordedQueries[0].sql).toContain(
        'WHERE "id" = $1 AND "learner_id" = $2 FOR UPDATE',
      );
      expect(recordedQueries[0].params).toEqual(['bkg-1', 'learner-1']);
    });

    it('returns unconfirmed result without UPDATE or outbox event on already-confirmed replay', async () => {
      const { registry, recordedQueries } = createQueueRegistry([
        [sampleConfirmedRow], // Already confirmed
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const outcome = await repo.confirmAndEmit('bkg-1', 'learner-1');

      expect(outcome.confirmed).toBe(false);
      expect(outcome.booking?.id).toBe('bkg-1');
      expect(outcome.booking?.state).toBe('confirmed');
      expect(recordedQueries).toHaveLength(1); // Only the SELECT FOR UPDATE
    });

    it('rejects confirmation and suppresses outbox emission when pending hold has expired (UPDATE returns 0 rows)', async () => {
      const { registry, recordedQueries } = createQueueRegistry([
        [samplePendingRow], // 1. Locked row is pending
        [], // 2. UPDATE ... WHERE ... ("expires_at" IS NULL OR "expires_at" > now()) returns 0 rows
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const outcome = await repo.confirmAndEmit('bkg-1', 'learner-1');

      expect(outcome.confirmed).toBe(false);
      expect(outcome.booking?.id).toBe('bkg-1');
      expect(outcome.booking?.state).toBe('pending');

      expect(recordedQueries).toHaveLength(2);
      expect(recordedQueries[1].sql).toContain(
        'WHERE "id" = $1 AND "state" = ' + "'pending' AND (" + '"expires_at" IS NULL OR "expires_at" > now())',
      );
      expect(recordedQueries[1].sql).not.toContain('confirmed_at');
      expect(recordedQueries[1].sql).not.toContain('state' + " = 'confirmed'");
      expect(recordedQueries[1].params).toEqual(['bkg-1']);
    });

    it('emits durable confirmation request with settled=false and returns pending booking without setting confirmed state (ADR-032 C3a)', async () => {
      const { registry, recordedQueries } = createQueueRegistry([
        [samplePendingRow], // 1. Locked row is pending
        [samplePendingRow], // 2. Atomic guard UPDATE returns pending row with updated_at refreshed
        [{ teacher_id: 'teacher-1' }], // 3. SELECT teacher_id
        [{ id: 'outbox-1' }], // 4. INSERT outbox
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const outcome = await repo.confirmAndEmit('bkg-1', 'learner-1');

      expect(outcome.confirmed).toBe(false);
      expect(outcome.booking?.id).toBe('bkg-1');
      expect(outcome.booking?.state).toBe('pending');

      expect(recordedQueries).toHaveLength(4);
      expect(recordedQueries[1].sql).toContain('UPDATE "live_class"."bookings" SET "updated_at" = now()');
      expect(recordedQueries[1].sql).toContain(
        'WHERE "id" = $1 AND "state" = ' + "'pending' AND (" + '"expires_at" IS NULL OR "expires_at" > now())',
      );
      expect(recordedQueries[1].sql).not.toContain('state' + " = 'confirmed'");
      expect(recordedQueries[1].sql).not.toContain('confirmed_at');
      expect(recordedQueries[1].params).toEqual(['bkg-1']);
      expect(recordedQueries[2].sql).toContain('SELECT "teacher_id" FROM "live_class"."classes" WHERE "id" = $1');
      expect(recordedQueries[2].params).toEqual(['cls-1']);
      expect(recordedQueries[3].sql).toContain('INSERT INTO "live_class"."outbox_messages"');
      expect(recordedQueries[3].params?.[0]).toBe('booking.confirmed');
      expect(recordedQueries[3].params?.[1]).toEqual({
        bookingId: 'bkg-1',
        classId: 'cls-1',
        studentId: 'learner-1',
        learnerId: 'learner-1',
        teacherId: 'teacher-1',
        amountCredits: 100,
        priceCredits: 100,
        settled: false,
      });
    });

    it('emits confirmation request for legacy pending hold where expires_at is null with settled=false', async () => {
      const legacyPendingRow = {
        ...samplePendingRow,
        expires_at: null,
      };
      const { registry, recordedQueries } = createQueueRegistry([
        [legacyPendingRow],
        [legacyPendingRow],
        [{ teacher_id: 'teacher-1' }],
        [{ id: 'outbox-1' }],
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const outcome = await repo.confirmAndEmit('bkg-1', 'learner-1');

      expect(outcome.confirmed).toBe(false);
      expect(outcome.booking?.state).toBe('pending');
      expect(recordedQueries).toHaveLength(4);
      expect(recordedQueries[1].sql).not.toContain('confirmed_at');
      expect(recordedQueries[1].sql).not.toContain('state' + " = 'confirmed'");
      expect(recordedQueries[3].params?.[1]).toMatchObject({ settled: false });
    });

    it('emits distinct durable request events across multiple valid confirm calls while pending (retry support)', async () => {
      const { registry, recordedQueries } = createQueueRegistry([
        // First confirm call
        [samplePendingRow],
        [samplePendingRow],
        [{ teacher_id: 'teacher-1' }],
        [{ id: 'outbox-1' }],
        // Second confirm call (e.g. retry after user topped up credits)
        [samplePendingRow],
        [samplePendingRow],
        [{ teacher_id: 'teacher-1' }],
        [{ id: 'outbox-2' }],
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const outcome1 = await repo.confirmAndEmit('bkg-1', 'learner-1');
      const outcome2 = await repo.confirmAndEmit('bkg-1', 'learner-1');

      expect(outcome1.confirmed).toBe(false);
      expect(outcome1.booking?.state).toBe('pending');
      expect(outcome2.confirmed).toBe(false);
      expect(outcome2.booking?.state).toBe('pending');

      expect(recordedQueries).toHaveLength(8);
      // First request emission
      expect(recordedQueries[3].sql).toContain('INSERT INTO "live_class"."outbox_messages"');
      expect(recordedQueries[3].params?.[0]).toBe('booking.confirmed');
      expect(recordedQueries[3].params?.[1]).toMatchObject({
        bookingId: 'bkg-1',
        settled: false,
      });
      // Second request emission (fresh outbox event)
      expect(recordedQueries[7].sql).toContain('INSERT INTO "live_class"."outbox_messages"');
      expect(recordedQueries[7].params?.[0]).toBe('booking.confirmed');
      expect(recordedQueries[7].params?.[1]).toMatchObject({
        bookingId: 'bkg-1',
        settled: false,
      });
    });

    it('propagates outbox failure and aborts transaction without claiming success', async () => {
      const outboxError = new Error('outbox storage failed');
      const { registry, recordedQueries } = createQueueRegistry([
        [samplePendingRow],
        [samplePendingRow],
        [{ teacher_id: 'teacher-1' }],
        outboxError,
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      await expect(repo.confirmAndEmit('bkg-1', 'learner-1')).rejects.toThrow('outbox storage failed');
      expect(recordedQueries).toHaveLength(4);
    });
  });

  describe('queries', () => {
    it('findByIdempotencyKey returns parsed booking or null', async () => {
      const { registry } = createQueueRegistry([
        [samplePendingRow],
        [],
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const found = await repo.findByIdempotencyKey('idem-1');
      expect(found?.id).toBe('bkg-1');
      expect(found?.createdAt).toEqual(NOW);

      const missing = await repo.findByIdempotencyKey('missing');
      expect(missing).toBeNull();
    });

    it('findById returns parsed booking or null', async () => {
      const { registry } = createQueueRegistry([
        [samplePendingRow],
        [],
      ]);

      const repo = new SqlBookingRepository(registry, 'live-class');
      const found = await repo.findById('bkg-1');
      expect(found?.id).toBe('bkg-1');

      const missing = await repo.findById('missing');
      expect(missing).toBeNull();
    });
  });
});
