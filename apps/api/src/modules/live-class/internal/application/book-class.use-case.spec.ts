import { BookClassUseCase, ClassNotFoundError } from './book-class.use-case';
import type {
  BookingRepository,
  BookingSeatRow,
  CreateBookingRecord,
  PersistedBooking,
} from './port/out/booking-repository';
import type { ClassRepository, CreateClassRecord, PersistedClass } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type { AccountTrustReader } from './port/out/account-trust';
import { BookingNotAllowedError, LearnerNotVerifiedError } from '../domain/booking';

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
  /** AC-034 / BR-001: which accounts hold an effective approved verification. */
  verifications?: Record<string, boolean>;
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
    startAndEmit: jest.fn(async () => ({ started: false })),
    completeAndEmit: jest.fn(async () => ({ completed: false, bookingIds: [] })),
    cancelWithReason: jest.fn(async () => ({ cancelled: false })),
    findAwaitingCompletion: jest.fn(async () => []),
    findInProgressBeforeEnd: jest.fn(async () => []),
    // FR-016 (W3): not exercised here; present so this mock stays a whole ClassRepository.
    findAwaitingReminder: jest.fn(async () => []),
    claimReminderAndEmit: jest.fn(async () => ({ reminded: false, participants: 0 })),
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
    hasTeacherNoShow: jest.fn(async () => false),
  };

  const clock: Clock = { now: () => NOW };
  // AC-034 / BR-001: the booking gate reads the trust projection, not a claim.
  const verifications = options.verifications ?? { 'learner-1': true };
  const teacherTrust: AccountTrustReader = {
    read: jest.fn(async (accountId: string) => ({
      verified: verifications[accountId] ?? false,
      approvedLevel: () => null,
    })),
  };
  return {
    useCase: new BookClassUseCase(classes, bookings, clock, teacherTrust),
    classes,
    bookings,
    teacherTrust,
  };
}

describe('BookClassUseCase', () => {
  // ── AC-034 / BR-001 (decided 2026-10-25): verified students only ──────────
  describe('booking trust gate (AC-034 / BR-001)', () => {
    it('refuses an account with no approved student verification', async () => {
      const { useCase } = setup({ verifications: { 'learner-1': false } });

      await expect(
        useCase.execute({ classId: 'cls-1', learnerId: 'learner-1', idempotencyKey: 'key-1' }),
      ).rejects.toBeInstanceOf(LearnerNotVerifiedError);
    });

    it('leaves no booking row, no seat hold and no credit movement behind', async () => {
      // The gate is on *booking*, not on confirmation, so a rejection must not
      // reach the write at all — otherwise a `pending` hold would occupy a seat
      // and a checkout could still be started for it.
      const { useCase, bookings } = setup({ verifications: { 'learner-1': false } });

      await expect(
        useCase.execute({ classId: 'cls-1', learnerId: 'learner-1', idempotencyKey: 'key-1' }),
      ).rejects.toBeInstanceOf(LearnerNotVerifiedError);

      expect(bookings.createWithSeatGuard).not.toHaveBeenCalled();
      expect(bookings.confirmAndEmit).not.toHaveBeenCalled();
    });

    it('treats a missing projection row as unverified', async () => {
      // A brand-new account has never had a `student.verification.*` event, so
      // the projection has no row. Absence must fail closed.
      const { useCase, bookings } = setup({ verifications: {} });

      await expect(
        useCase.execute({ classId: 'cls-1', learnerId: 'learner-1', idempotencyKey: 'key-1' }),
      ).rejects.toBeInstanceOf(LearnerNotVerifiedError);
      expect(bookings.createWithSeatGuard).not.toHaveBeenCalled();
    });

    it('carries the stable `learner_not_verified` reason code', async () => {
      const { useCase } = setup({ verifications: { 'learner-1': false } });

      try {
        await useCase.execute({ classId: 'cls-1', learnerId: 'learner-1', idempotencyKey: 'key-1' });
        throw new Error('expected the booking to be refused');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(LearnerNotVerifiedError);
        expect((error as LearnerNotVerifiedError).reason).toBe('learner_not_verified');
      }
    });

    it('lets a verified account book', async () => {
      const { useCase } = setup({ verifications: { 'learner-1': true } });

      const result = await useCase.execute({
        classId: 'cls-1',
        learnerId: 'learner-1',
        idempotencyKey: 'key-1',
      });

      expect(result.created).toBe(true);
    });

    it('does not re-gate an idempotent replay of a booking made before revocation', async () => {
      // A replay returns the booking that already exists; it is not a new attempt.
      // Gate-on-booking, decided 2026-10-25: only *new* bookings are refused.
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
      const { useCase } = setup({ replay, verifications: { 'learner-1': false } });

      const result = await useCase.execute({
        classId: 'cls-1',
        learnerId: 'learner-1',
        idempotencyKey: 'key-1',
      });

      expect(result.created).toBe(false);
      expect(result.booking.bookingId).toBe('bkg-old');
    });
  });

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

  it('returns the stored booking on an idempotent replay even if already confirmed', async () => {
    const replay: PersistedBooking = {
      id: 'bkg-old',
      classId: 'cls-1',
      learnerId: 'learner-1',
      state: 'confirmed',
      priceCredits: 100,
      idempotencyKey: 'key-1',
      createdAt: NOW,
      expiresAt: null,
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
    expect(result.booking.state).toBe('confirmed');
  });

  it('rejects an idempotent replay attempt with a different learner without leaking booking details', async () => {
    const replay: PersistedBooking = {
      id: 'bkg-victim',
      classId: 'cls-1',
      learnerId: 'victim-learner',
      state: 'pending',
      priceCredits: 100,
      idempotencyKey: 'key-1',
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
    };
    const { useCase, bookings } = setup({ replay });

    await expect(
      useCase.execute({
        classId: 'cls-1',
        learnerId: 'attacker-learner',
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow(BookingNotAllowedError);

    try {
      await useCase.execute({
        classId: 'cls-1',
        learnerId: 'attacker-learner',
        idempotencyKey: 'key-1',
      });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BookingNotAllowedError);
      const bne = error as BookingNotAllowedError;
      expect(bne.reason).toBe('duplicate_booking');
      expect(bne.message).not.toContain('victim-learner');
      expect(bne.message).not.toContain('bkg-victim');
    }
    expect(bookings.createWithSeatGuard).not.toHaveBeenCalled();
  });

  it('rejects an idempotent replay attempt with a different class without leaking booking details', async () => {
    const replay: PersistedBooking = {
      id: 'bkg-other',
      classId: 'cls-other',
      learnerId: 'learner-1',
      state: 'pending',
      priceCredits: 100,
      idempotencyKey: 'key-1',
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
    };
    const { useCase, bookings } = setup({ replay });

    await expect(
      useCase.execute({
        classId: 'cls-1',
        learnerId: 'learner-1',
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow(BookingNotAllowedError);

    try {
      await useCase.execute({
        classId: 'cls-1',
        learnerId: 'learner-1',
        idempotencyKey: 'key-1',
      });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BookingNotAllowedError);
      const bne = error as BookingNotAllowedError;
      expect(bne.reason).toBe('duplicate_booking');
      expect(bne.message).not.toContain('cls-other');
      expect(bne.message).not.toContain('bkg-other');
    }
    expect(bookings.createWithSeatGuard).not.toHaveBeenCalled();
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
