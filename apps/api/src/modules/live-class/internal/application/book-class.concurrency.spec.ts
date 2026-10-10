import { BookClassUseCase } from './book-class.use-case';
import { BookingNotAllowedError } from '../domain/booking';
import type {
  BookingRepository,
  BookingSeatRow,
  CreateBookingRecord,
  PersistedBooking,
} from './port/out/booking-repository';
import type { ClassRepository, PersistedClass } from './port/out/class-repository';
import type { Clock } from './port/out/clock';

/**
 * AC-010 acceptance at the application boundary.
 *
 * The real guard is the database: `createWithSeatGuard` locks the class row so
 * two concurrent transactions serialize, and a unique index on
 * (class_id, learner_id) for active states blocks duplicates. This in-memory
 * repository reproduces both behaviours (a promise-chain lock per class plus
 * the uniqueness rule) so the use case is exercised under a genuine race.
 */
class LockingInMemoryBookingRepository implements BookingRepository {
  private readonly rows: PersistedBooking[] = [];
  private readonly locks = new Map<string, Promise<unknown>>();
  private sequence = 0;

  async findByIdempotencyKey(idempotencyKey: string): Promise<PersistedBooking | null> {
    return this.rows.find((row) => row.idempotencyKey === idempotencyKey) ?? null;
  }

  createWithSeatGuard(
    record: CreateBookingRecord,
    guard: (seatRows: readonly BookingSeatRow[]) => void,
  ): Promise<{ booking: PersistedBooking; created: boolean }> {
    // Serialize per class, like `SELECT ... FOR UPDATE` on the class row.
    const previous = this.locks.get(record.classId) ?? Promise.resolve();
    const run = previous.then(() => this.apply(record, guard));
    this.locks.set(
      record.classId,
      run.catch(() => undefined),
    );
    return run;
  }

  private async apply(
    record: CreateBookingRecord,
    guard: (seatRows: readonly BookingSeatRow[]) => void,
  ): Promise<{ booking: PersistedBooking; created: boolean }> {
    const replay = this.rows.find((row) => row.idempotencyKey === record.idempotencyKey);
    if (replay !== undefined) {
      return { booking: replay, created: false };
    }
    const seatRows: BookingSeatRow[] = this.rows
      .filter(
        (row) =>
          row.classId === record.classId &&
          (row.state === 'pending' || row.state === 'confirmed'),
      )
      .map((row) => ({ learnerId: row.learnerId, state: row.state }));

    guard(seatRows);

    // Unique index: (class_id, learner_id) for active states.
    if (
      seatRows.some((row) => row.learnerId === record.learnerId)
    ) {
      throw new Error('duplicate key value violates unique constraint uq_bookings_active_learner_class');
    }

    const booking: PersistedBooking = {
      id: `bkg-${++this.sequence}`,
      classId: record.classId,
      learnerId: record.learnerId,
      state: record.state,
      priceCredits: record.priceCredits,
      idempotencyKey: record.idempotencyKey,
      createdAt: new Date(),
    };
    this.rows.push(booking);
    return { booking, created: true };
  }

  async confirmAndEmit(
    bookingId: string,
    learnerId: string,
  ): Promise<{ confirmed: boolean; booking: PersistedBooking | null }> {
    const row = this.rows.find((r) => r.id === bookingId && r.learnerId === learnerId);
    if (row === undefined || row.state !== 'pending') {
      return { confirmed: false, booking: row ?? null };
    }
    row.state = 'confirmed';
    return { confirmed: true, booking: row };
  }
}

function classRepo(view: PersistedClass): ClassRepository {
  return {
    insert: jest.fn(),
    findById: jest.fn(async () => view),
  };
}

function fixedClock(now: Date): Clock {
  return { now: () => now };
}

describe('BookClassUseCase concurrency (AC-010)', () => {
  const now = new Date('2026-10-08T00:00:00.000Z');
  const classView: PersistedClass = {
    id: 'cls-1',
    teacherId: 'teacher-1',
    state: 'published',
    startsAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 1,
    description: 'Guitar',
    skillIds: ['skill-1'],
  };

  it('confirms exactly one booking when two learners race for the last seat', async () => {
    const bookings = new LockingInMemoryBookingRepository();
    const useCase = new BookClassUseCase(classRepo(classView), bookings, fixedClock(now));

    const results = await Promise.allSettled([
      useCase.execute({ classId: 'cls-1', learnerId: 'learner-a', idempotencyKey: 'key-a' }),
      useCase.execute({ classId: 'cls-1', learnerId: 'learner-b', idempotencyKey: 'key-b' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BookingNotAllowedError);
    expect((rejected[0] as PromiseRejectedResult).reason.reason).toBe('class_full');
  });

  it('is idempotent under a concurrent replay of the same key', async () => {
    const bookings = new LockingInMemoryBookingRepository();
    const useCase = new BookClassUseCase(classRepo(classView), bookings, fixedClock(now));

    const [first, second] = await Promise.all([
      useCase.execute({ classId: 'cls-1', learnerId: 'learner-a', idempotencyKey: 'same' }),
      useCase.execute({ classId: 'cls-1', learnerId: 'learner-a', idempotencyKey: 'same' }),
    ]);

    expect(first.booking.bookingId).toBe(second.booking.bookingId);
    expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
  });

  it('rejects a second booking by the same learner on the same class (BR-024)', async () => {
    const bookings = new LockingInMemoryBookingRepository();
    const multiSeat = { ...classView, capacity: 5 };
    const useCase = new BookClassUseCase(classRepo(multiSeat), bookings, fixedClock(now));

    await useCase.execute({ classId: 'cls-1', learnerId: 'learner-a', idempotencyKey: 'k1' });
    await expect(
      useCase.execute({ classId: 'cls-1', learnerId: 'learner-a', idempotencyKey: 'k2' }),
    ).rejects.toThrow(BookingNotAllowedError);
  });
});
