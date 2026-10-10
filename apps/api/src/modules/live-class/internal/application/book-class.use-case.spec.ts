import { BookClassUseCase, ClassNotFoundError } from './book-class.use-case';
import type {
  BookingRepository,
  BookingSeatRow,
  CreateBookingRecord,
  PersistedBooking,
} from './port/out/booking-repository';
import type { ClassRepository, CreateClassRecord, PersistedClass } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import { BookingNotAllowedError } from '../domain/booking';

const NOW = new Date('2026-10-08T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function persistedClass(overrides: Partial<PersistedClass> = {}): PersistedClass {
  return {
    id: 'cls-1',
    teacherId: 'teacher-1',
    state: 'published',
    startsAt: new Date(NOW.getTime() + 48 * HOUR),
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 1,
    description: 'Guitar',
    skillIds: ['skill-1'],
    ...overrides,
  };
}

function setup(options: {
  classView?: PersistedClass | null;
  seatRows?: BookingSeatRow[];
  replay?: PersistedBooking | null;
} = {}) {
  const classView = options.classView === undefined ? persistedClass() : options.classView;
  const classes: ClassRepository = {
    insert: jest.fn(async (record: CreateClassRecord) =>
      persistedClass({ ...record, id: 'cls-new' }),
    ),
    findById: jest.fn(async () => classView),
    update: jest.fn(async (_id: string, edit) =>
      persistedClass({ ...edit, teacherId: 'teacher-1', state: 'published' }),
    ),
    markCancelled: jest.fn(async () => undefined),
  };

  const bookings: BookingRepository = {
    findByIdempotencyKey: jest.fn(async () => options.replay ?? null),
    findById: jest.fn(async () => null),
    createWithSeatGuard: jest.fn(
      async (
        record: CreateBookingRecord,
        guard: (seatRows: readonly BookingSeatRow[]) => void,
      ) => {
        guard(options.seatRows ?? []);
        const booking: PersistedBooking = {
          id: 'bkg-1',
          classId: record.classId,
          learnerId: record.learnerId,
          state: record.state,
          priceCredits: record.priceCredits,
          idempotencyKey: record.idempotencyKey,
          createdAt: NOW,
          expiresAt: record.expiresAt,
        };
        return { booking, created: true };
      },
    ),
    confirmAndEmit: jest.fn(async () => ({ confirmed: false, booking: null })),
    cancelAndEmit: jest.fn(async () => ({ cancelled: false, booking: null })),
    expirePendingHolds: jest.fn(async () => 0),
    countByClassAndState: jest.fn(async () => 0),
    findActiveByClass: jest.fn(async () => []),
  };

  const clock: Clock = { now: () => NOW };
  return { useCase: new BookClassUseCase(classes, bookings, clock), classes, bookings };
}

describe('BookClassUseCase', () => {
  it('creates a pending booking holding a seat', async () => {
    const { useCase, bookings } = setup();
    const result = await useCase.execute({
      classId: 'cls-1',
      learnerId: 'learner-1',
      idempotencyKey: 'key-1',
    });
    expect(bookings.createWithSeatGuard).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(true);
    expect(result.booking).toEqual({
      bookingId: 'bkg-1',
      classId: 'cls-1',
      learnerId: 'learner-1',
      state: 'pending',
      priceCredits: 100,
      createdAt: NOW.toISOString(),
    });
  });

  it('returns the stored booking on an idempotent replay', async () => {
    const replay: PersistedBooking = {
      id: 'bkg-old',
      classId: 'cls-1',
      learnerId: 'learner-1',
      state: 'pending',
      priceCredits: 100,
      idempotencyKey: 'key-1',
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
    };
    const { useCase, bookings } = setup({ replay });
    const result = await useCase.execute({
      classId: 'cls-1',
      learnerId: 'learner-1',
      idempotencyKey: 'key-1',
    });
    expect(bookings.createWithSeatGuard).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.booking.bookingId).toBe('bkg-old');
  });

  it('fails when the class does not exist', async () => {
    const { useCase } = setup({ classView: null });
    await expect(
      useCase.execute({ classId: 'missing', learnerId: 'learner-1', idempotencyKey: 'k' }),
    ).rejects.toThrow(ClassNotFoundError);
  });

  it('rejects a class inside the 24-hour window without creating a booking', async () => {
    const classView = persistedClass({ startsAt: new Date(NOW.getTime() + HOUR) });
    const { useCase, bookings } = setup({ classView });
    await expect(
      useCase.execute({ classId: 'cls-1', learnerId: 'learner-1', idempotencyKey: 'k' }),
    ).rejects.toThrow(BookingNotAllowedError);
    expect(bookings.createWithSeatGuard).toHaveBeenCalledTimes(1);
  });

  it('rejects a full class', async () => {
    const { useCase } = setup({ seatRows: [{ learnerId: 'other', state: 'confirmed' }] });
    await expect(
      useCase.execute({ classId: 'cls-1', learnerId: 'learner-1', idempotencyKey: 'k' }),
    ).rejects.toThrow(BookingNotAllowedError);
  });
});
